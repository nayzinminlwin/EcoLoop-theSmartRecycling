// =============================================================================
// firebaseRewardRepository.ts — Firebase-backed AdminRewardsRepository implementation
// Phase AB-03 — list, watchList, get, watch, and getCategories for reward catalog
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  doc,
  collection,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import type {
  AdminRewardsRepository,
  Observable,
  Observer,
  Unsubscribe,
} from "../repositories.ts";
import type {
  RewardListQuery,
  Page,
  RewardInput,
} from "../../contracts/admin.ts";
import type { Reward, RewardCategory } from "../../contracts/shared.ts";
import {
  decodeAdminRewardView,
  decodeAdminRewardCategoryView,
  decodeAdminPaginatedResponse,
  adminRewardViewToReward,
  type AdminRewardView,
  type AdminPaginatedResponse,
} from "../../contracts/adminViewCodecs.ts";
import type { FirebaseCommandClient } from "../../core/firebase/commandClient.ts";

export class FirebaseRewardRepository implements AdminRewardsRepository {
  private readonly functions: Functions;
  private readonly firestore: Firestore;
  private readonly commandClient: FirebaseCommandClient;
  private readonly fallbackRewardsRepo: AdminRewardsRepository;

  constructor(
    functions: Functions,
    firestore: Firestore,
    commandClient: FirebaseCommandClient,
    fallbackRewardsRepo: AdminRewardsRepository
  ) {
    this.functions = functions;
    this.firestore = firestore;
    this.commandClient = commandClient;
    this.fallbackRewardsRepo = fallbackRewardsRepo;
  }

  private mapSortKey(key: string): string {
    switch (key) {
      case "pointsCost":
        return "pointsCost";
      case "name":
      case "title":
        return "title";
      case "expiresAt":
        return "expiresAt";
      default:
        return "sortOrder";
    }
  }

  async list(query: RewardListQuery): Promise<Page<Reward>> {
    try {
      const callable = httpsCallable<
        Record<string, unknown>,
        AdminPaginatedResponse<AdminRewardView>
      >(this.functions, "listAdminRewards");

      const filters: Record<string, unknown> = {};
      if (query.categoryId) {
        filters.categoryId = query.categoryId;
      }
      if (query.publication === "active") {
        filters.isActive = true;
      } else if (query.publication === "draft") {
        filters.isActive = false;
      }

      const res = await callable({
        search: query.search || undefined,
        sortKey: this.mapSortKey(query.sort.key),
        sortDirection: query.sort.direction,
        pageSize: query.pageSize,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      const decoded = decodeAdminPaginatedResponse(res.data, decodeAdminRewardView);
      const rewards = decoded.items.map(adminRewardViewToReward);

      return {
        items: rewards,
        total: decoded.total,
        page: query.page,
        pageSize: query.pageSize,
      };
    } catch {
      return await this.fallbackRewardsRepo.list(query);
    }
  }

  watchList(query: RewardListQuery): Observable<Page<Reward>> {
    return {
      subscribe: (observer: Observer<Page<Reward>>): Unsubscribe => {
        let isSubscribed = true;

        const load = () => {
          this.list(query)
            .then((page) => {
              if (isSubscribed) observer.next(page);
            })
            .catch((err) => {
              if (isSubscribed) {
                observer.error(this.commandClient.mapFirebaseError(err, "listAdminRewards").failure);
              }
            });
        };

        load();

        const versionDocRef = doc(this.firestore, "adminReadVersions/rewards");
        const unsubscribeSnapshot = onSnapshot(
          versionDocRef,
          () => {
            if (isSubscribed) load();
          },
          () => {
            // Silently keep current data on error
          }
        );

        return () => {
          isSubscribed = false;
          unsubscribeSnapshot();
        };
      },
    };
  }

  async get(id: string): Promise<Reward> {
    try {
      const callable = httpsCallable<{ rewardId: string }, unknown>(
        this.functions,
        "getAdminReward"
      );
      const res = await callable({ rewardId: id });
      const view = decodeAdminRewardView(res.data);
      return adminRewardViewToReward(view);
    } catch {
      return await this.fallbackRewardsRepo.get(id);
    }
  }

  watch(id: string): Observable<Reward | null> {
    return {
      subscribe: (observer: Observer<Reward | null>): Unsubscribe => {
        let isSubscribed = true;
        const rewardDocRef = doc(this.firestore, `adminRewardViews/${id}`);

        const unsubscribe = onSnapshot(
          rewardDocRef,
          (snap) => {
            if (!isSubscribed) return;
            if (!snap.exists()) {
              observer.next(null);
              return;
            }
            try {
              const view = decodeAdminRewardView({ rewardId: snap.id, ...snap.data() });
              observer.next(adminRewardViewToReward(view));
            } catch {
              observer.next(null);
            }
          },
          () => {
            if (!isSubscribed) return;
            this.fallbackRewardsRepo.watch(id).subscribe(observer);
          }
        );

        return () => {
          isSubscribed = false;
          unsubscribe();
        };
      },
    };
  }

  async getCategories(): Promise<RewardCategory[]> {
    try {
      const callable = httpsCallable<void, unknown[]>(
        this.functions,
        "getAdminRewardCategories"
      );
      const res = await callable();
      const views = (res.data ?? []).map(decodeAdminRewardCategoryView);
      return views.map((v) => ({
        id: v.categoryId,
        label: v.categoryName,
        sortOrder: v.sortOrder,
      }));
    } catch {
      return await this.fallbackRewardsRepo.getCategories();
    }
  }

  watchCategories(): Observable<RewardCategory[]> {
    return {
      subscribe: (observer: Observer<RewardCategory[]>): Unsubscribe => {
        let isSubscribed = true;
        const colRef = collection(this.firestore, "adminRewardCategoryViews");

        const unsubscribe = onSnapshot(
          colRef,
          (snap) => {
            if (!isSubscribed) return;
            try {
              const cats = snap.docs.map((d) => {
                const v = decodeAdminRewardCategoryView({ categoryId: d.id, ...d.data() });
                return {
                  id: v.categoryId,
                  label: v.categoryName,
                  sortOrder: v.sortOrder,
                };
              });
              observer.next(cats);
            } catch {
              this.fallbackRewardsRepo.watchCategories().subscribe(observer);
            }
          },
          () => {
            if (!isSubscribed) return;
            this.fallbackRewardsRepo.watchCategories().subscribe(observer);
          }
        );

        return () => {
          isSubscribed = false;
          unsubscribe();
        };
      },
    };
  }

  async create(input: RewardInput): Promise<Reward> {
    try {
      const payload = {
        title: input.title,
        description: input.description,
        merchantName: input.merchantName,
        categoryId: input.categoryId,
        tag: input.tag ?? null,
        imageUrl: input.imageUrl ?? null,
        pointsCost: input.pointsCost,
        expiresAt: input.expiresAt,
        isActive: input.isActive,
        maxRedemptionsPerResident: input.maxRedemptionsPerResident,
        artKey: input.artKey,
        sortOrder: input.sortOrder,
        isDemo: true,
        terms: input.terms ?? "Standard demo reward terms apply.",
      };

      const res = await this.commandClient.execute("adminCreateReward", payload);
      const data = res.data as Record<string, unknown>;
      const view = decodeAdminRewardView(data);
      return adminRewardViewToReward(view);
    } catch (err) {
      throw this.commandClient.mapFirebaseError(err, "adminCreateReward");
    }
  }

  async update(id: string, input: RewardInput): Promise<Reward> {
    try {
      let expectedVersion = input.expectedVersion;
      if (expectedVersion === undefined) {
        const callable = httpsCallable<{ rewardId: string }, unknown>(
          this.functions,
          "getAdminReward"
        );
        const res = await callable({ rewardId: id });
        const view = decodeAdminRewardView(res.data);
        expectedVersion = view.version;
      }

      const payload = {
        rewardId: id,
        expectedVersion,
        title: input.title,
        description: input.description,
        merchantName: input.merchantName,
        categoryId: input.categoryId,
        tag: input.tag ?? null,
        imageUrl: input.imageUrl ?? null,
        pointsCost: input.pointsCost,
        expiresAt: input.expiresAt,
        isActive: input.isActive,
        maxRedemptionsPerResident: input.maxRedemptionsPerResident,
        artKey: input.artKey,
        sortOrder: input.sortOrder,
        isDemo: true,
        terms: input.terms ?? "Standard demo reward terms apply.",
      };

      const res = await this.commandClient.execute("adminUpdateReward", payload);
      const data = res.data as Record<string, unknown>;
      const view = decodeAdminRewardView(data);
      return adminRewardViewToReward(view);
    } catch (err) {
      throw this.commandClient.mapFirebaseError(err, "adminUpdateReward");
    }
  }

  async delete(id: string, expectedVersion?: number): Promise<void> {
    try {
      let ver = expectedVersion;
      if (ver === undefined) {
        const callable = httpsCallable<{ rewardId: string }, unknown>(
          this.functions,
          "getAdminReward"
        );
        const res = await callable({ rewardId: id });
        const view = decodeAdminRewardView(res.data);
        ver = view.version;
      }

      await this.commandClient.execute("adminDeleteUnusedReward", {
        rewardId: id,
        expectedVersion: ver,
      });
    } catch (err) {
      throw this.commandClient.mapFirebaseError(err, "adminDeleteUnusedReward");
    }
  }
}
