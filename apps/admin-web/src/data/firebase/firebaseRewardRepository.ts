// =============================================================================
// firebaseRewardRepository.ts — Firebase-backed AdminRewardsRepository implementation
// Phase AB-03/AB-08 — list, watchList, get, watch, categories, CRUD & vouchers
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  doc,
  collection,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";
import type {
  AdminRewardsRepository,
  Observable,
  Observer,
  Unsubscribe,
  VoucherListQuery,
} from "../repositories.ts";
import type {
  RewardListQuery,
  Page,
  RewardInput,
} from "../../contracts/admin.ts";
import type { Reward, RewardCategory, ResidentVoucher, VoucherStatus } from "../../contracts/shared.ts";
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

  private mapCanonicalRewardDocToReward(id: string, data: Record<string, unknown>): Reward {
    const validArtKeys = ["art0", "art1", "art2", "art3"] as const;
    let artKey = "art0";
    if (typeof data.artKey === "string") {
      if (validArtKeys.includes(data.artKey as (typeof validArtKeys)[number])) {
        artKey = data.artKey;
      } else if (data.artKey === "cafe") {
        artKey = "art1";
      } else if (data.artKey === "meal") {
        artKey = "art2";
      } else if (data.artKey === "shopping") {
        artKey = "art3";
      }
    }

    let expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
    if (data.catalogExpiresAt) {
      if (typeof (data.catalogExpiresAt as { toDate?: () => Date }).toDate === "function") {
        expiresAt = (data.catalogExpiresAt as { toDate: () => Date }).toDate().toISOString();
      } else if (typeof data.catalogExpiresAt === "string") {
        expiresAt = data.catalogExpiresAt;
      }
    } else if (data.expiresAt) {
      if (typeof (data.expiresAt as { toDate?: () => Date }).toDate === "function") {
        expiresAt = (data.expiresAt as { toDate: () => Date }).toDate().toISOString();
      } else if (typeof data.expiresAt === "string") {
        expiresAt = data.expiresAt;
      }
    }

    const defaultImages: Record<string, string> = {
      art0: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80",
      art1: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80",
      art2: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
      art3: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80",
    };

    const imageUrl = typeof data.imageUrl === "string" && data.imageUrl.startsWith("https://")
      ? data.imageUrl
      : defaultImages[artKey] ?? defaultImages.art0;

    return {
      id,
      title: String(data.title ?? data.name ?? id),
      description: String(data.description ?? ""),
      merchantName: String(data.merchantName ?? data.merchant ?? "EcoLoop Partner"),
      categoryId: String(data.categoryId ?? "food"),
      tag: data.tag ? String(data.tag) : null,
      imageUrl,
      pointsCost: Math.max(1, Number(data.pointsCost ?? 100)),
      expiresAt,
      isActive: data.isActive !== false,
      maxRedemptionsPerResident: Math.max(1, Number(data.maxRedemptionsPerResident ?? 1)),
      residentRedemptionCount: 0,
      artKey,
      sortOrder: Math.max(0, Number(data.sortOrder ?? 0)),
    };
  }

  private filterAndPaginateRewards(rewards: Reward[], query: RewardListQuery): Page<Reward> {
    let filtered = [...rewards];

    if (query.search && query.search.trim()) {
      const q = query.search.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.merchantName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.tag && r.tag.toLowerCase().includes(q))
      );
    }

    if (query.categoryId && query.categoryId !== "all") {
      filtered = filtered.filter((r) => r.categoryId === query.categoryId);
    }

    if (query.publication === "active") {
      filtered = filtered.filter((r) => r.isActive);
    } else if (query.publication === "draft") {
      filtered = filtered.filter((r) => !r.isActive);
    }

    const sortKey = query.sort.key;
    const isAsc = query.sort.direction === "asc";
    filtered.sort((a, b) => {
      let va: string | number = a.sortOrder;
      let vb: string | number = b.sortOrder;

      if (sortKey === "title") {
        va = a.title.toLowerCase();
        vb = b.title.toLowerCase();
      } else if (sortKey === "pointsCost") {
        va = a.pointsCost;
        vb = b.pointsCost;
      } else if (sortKey === "expiresAt") {
        va = new Date(a.expiresAt).getTime();
        vb = new Date(b.expiresAt).getTime();
      }

      if (va < vb) return isAsc ? -1 : 1;
      if (va > vb) return isAsc ? 1 : -1;
      return 0;
    });

    const total = filtered.length;
    const startIndex = (query.page - 1) * query.pageSize;
    const items = filtered.slice(startIndex, startIndex + query.pageSize);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async list(query: RewardListQuery): Promise<Page<Reward>> {
    // 1. Try Cloud Function listAdminRewards
    try {
      const callable = httpsCallable<
        Record<string, unknown>,
        AdminPaginatedResponse<AdminRewardView>
      >(this.functions, "listAdminRewards");

      const filters: Record<string, unknown> = {};
      if (query.categoryId && query.categoryId !== "all") {
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
      if (decoded.items && decoded.items.length > 0) {
        const rewards = decoded.items.map(adminRewardViewToReward);
        return {
          items: rewards,
          total: decoded.total,
          page: query.page,
          pageSize: query.pageSize,
        };
      }
    } catch {
      // Fall through to direct Firestore connection
    }

    // 2. Direct Firestore connection (adminRewardViews & rewards)
    try {
      let rewards: Reward[] = [];

      const viewsSnap = await getDocs(collection(this.firestore, "adminRewardViews"));
      if (!viewsSnap.empty) {
        rewards = viewsSnap.docs.map((d) => {
          const view = decodeAdminRewardView({ rewardId: d.id, ...d.data() });
          return adminRewardViewToReward(view);
        });
      } else {
        const rewSnap = await getDocs(collection(this.firestore, "rewards"));
        if (!rewSnap.empty) {
          rewards = rewSnap.docs.map((d) => this.mapCanonicalRewardDocToReward(d.id, d.data()));
        }
      }

      if (rewards.length > 0) {
        return this.filterAndPaginateRewards(rewards, query);
      }
    } catch {
      // Offline / unit test fallback below
    }

    // 3. Fallback to baseline mock repository
    return await this.fallbackRewardsRepo.list(query);
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

        const unsubs: (() => void)[] = [];

        try {
          const versionDocRef = doc(this.firestore, "adminReadVersions/rewards");
          unsubs.push(
            onSnapshot(
              versionDocRef,
              () => { if (isSubscribed) load(); },
              () => { /* Silently keep current data on error */ }
            )
          );
        } catch { /* ignore */ }

        try {
          const adminViewsCol = collection(this.firestore, "adminRewardViews");
          unsubs.push(
            onSnapshot(
              adminViewsCol,
              () => { if (isSubscribed) load(); },
              () => { /* Silently keep current data on error */ }
            )
          );
        } catch { /* ignore */ }

        try {
          const rewardsCol = collection(this.firestore, "rewards");
          unsubs.push(
            onSnapshot(
              rewardsCol,
              () => { if (isSubscribed) load(); },
              () => { /* Silently keep current data on error */ }
            )
          );
        } catch { /* ignore */ }

        return () => {
          isSubscribed = false;
          for (const u of unsubs) u();
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
      // Direct Firestore check
      try {
        const viewSnap = await getDoc(doc(this.firestore, "adminRewardViews", id));
        if (viewSnap.exists()) {
          const view = decodeAdminRewardView({ rewardId: viewSnap.id, ...viewSnap.data() });
          return adminRewardViewToReward(view);
        }

        const rewSnap = await getDoc(doc(this.firestore, "rewards", id));
        if (rewSnap.exists()) {
          return this.mapCanonicalRewardDocToReward(rewSnap.id, rewSnap.data());
        }
      } catch {
        // Fall through to fallback
      }

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
      if (res.data && res.data.length > 0) {
        const views = res.data.map(decodeAdminRewardCategoryView);
        return views.map((v) => ({
          id: v.categoryId,
          label: v.categoryName,
          sortOrder: v.sortOrder,
        }));
      }
    } catch {
      // Fall through to direct Firestore connection
    }

    try {
      const catViewsSnap = await getDocs(collection(this.firestore, "adminRewardCategoryViews"));
      if (!catViewsSnap.empty) {
        return catViewsSnap.docs
          .map((d) => {
            const v = decodeAdminRewardCategoryView({ categoryId: d.id, ...d.data() });
            return { id: v.categoryId, label: v.categoryName, sortOrder: v.sortOrder };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);
      }

      const categoriesSnap = await getDocs(collection(this.firestore, "rewardCategories"));
      if (!categoriesSnap.empty) {
        return categoriesSnap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              label: String(data.displayName ?? data.categoryName ?? data.label ?? d.id),
              sortOrder: Number(data.sortOrder ?? 0),
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);
      }
    } catch {
      // offline fallback
    }

    return await this.fallbackRewardsRepo.getCategories();
  }

  watchCategories(): Observable<RewardCategory[]> {
    return {
      subscribe: (observer: Observer<RewardCategory[]>): Unsubscribe => {
        let isSubscribed = true;

        const load = () => {
          this.getCategories()
            .then((cats) => {
              if (isSubscribed) observer.next(cats);
            })
            .catch(() => {
              if (isSubscribed) this.fallbackRewardsRepo.watchCategories().subscribe(observer);
            });
        };

        load();

        const unsubs: (() => void)[] = [];
        try {
          unsubs.push(
            onSnapshot(
              collection(this.firestore, "adminRewardCategoryViews"),
              () => { if (isSubscribed) load(); },
              () => { /* Silently ignore */ }
            )
          );
        } catch { /* ignore */ }

        try {
          unsubs.push(
            onSnapshot(
              collection(this.firestore, "rewardCategories"),
              () => { if (isSubscribed) load(); },
              () => { /* Silently ignore */ }
            )
          );
        } catch { /* ignore */ }

        return () => {
          isSubscribed = false;
          for (const u of unsubs) u();
        };
      },
    };
  }

  async create(input: RewardInput): Promise<Reward> {
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

    try {
      const res = await this.commandClient.execute("adminCreateReward", payload);
      const data = res.data as Record<string, unknown>;
      const view = decodeAdminRewardView(data);
      return adminRewardViewToReward(view);
    } catch (err) {
      // Direct Firestore fallback for client write resiliency
      try {
        const rewardId = `reward-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        const rewardDoc = {
          id: rewardId,
          title: input.title,
          description: input.description,
          merchantName: input.merchantName,
          merchant: input.merchantName,
          categoryId: input.categoryId,
          tag: input.tag ?? null,
          imageUrl: input.imageUrl ?? null,
          pointsCost: input.pointsCost,
          expiresAt: input.expiresAt,
          catalogExpiresAt: input.expiresAt,
          isActive: input.isActive,
          maxRedemptionsPerResident: input.maxRedemptionsPerResident,
          artKey: input.artKey,
          sortOrder: input.sortOrder,
          terms: input.terms ?? "Standard demo reward terms apply.",
          version: 1,
          isDemo: true,
          updatedAt: now,
          createdAt: now,
        };
        await setDoc(doc(this.firestore, "rewards", rewardId), rewardDoc);

        const viewDoc = {
          rewardId,
          title: input.title,
          description: input.description,
          merchantName: input.merchantName,
          categoryId: input.categoryId,
          categoryName: input.categoryId,
          tag: input.tag ?? null,
          imageUrl: input.imageUrl ?? null,
          pointsCost: input.pointsCost,
          expiresAt: input.expiresAt,
          isActive: input.isActive,
          maxRedemptionsPerResident: input.maxRedemptionsPerResident,
          artKey: input.artKey,
          sortOrder: input.sortOrder,
          terms: input.terms ?? null,
          version: 1,
          isDemo: true,
          updatedAt: now,
        };
        await setDoc(doc(this.firestore, "adminRewardViews", rewardId), viewDoc);
        return adminRewardViewToReward(decodeAdminRewardView(viewDoc));
      } catch {
        throw this.commandClient.mapFirebaseError(err, "adminCreateReward");
      }
    }
  }

  async update(id: string, input: RewardInput): Promise<Reward> {
    let expectedVersion = input.expectedVersion;
    if (expectedVersion === undefined) {
      try {
        const callable = httpsCallable<{ rewardId: string }, unknown>(
          this.functions,
          "getAdminReward"
        );
        const res = await callable({ rewardId: id });
        const view = decodeAdminRewardView(res.data);
        expectedVersion = view.version;
      } catch {
        // Direct read
        try {
          const snap = await getDoc(doc(this.firestore, "adminRewardViews", id));
          if (snap.exists()) {
            expectedVersion = Number(snap.data()?.version ?? 1);
          }
        } catch { /* ignore */ }
      }
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

    try {
      const res = await this.commandClient.execute("adminUpdateReward", payload);
      const data = res.data as Record<string, unknown>;
      const view = decodeAdminRewardView(data);
      return adminRewardViewToReward(view);
    } catch (err) {
      // Direct Firestore fallback
      try {
        const nextVersion = (expectedVersion ?? 1) + 1;
        const now = new Date().toISOString();
        const updateData = {
          title: input.title,
          description: input.description,
          merchantName: input.merchantName,
          merchant: input.merchantName,
          categoryId: input.categoryId,
          tag: input.tag ?? null,
          imageUrl: input.imageUrl ?? null,
          pointsCost: input.pointsCost,
          expiresAt: input.expiresAt,
          catalogExpiresAt: input.expiresAt,
          isActive: input.isActive,
          maxRedemptionsPerResident: input.maxRedemptionsPerResident,
          artKey: input.artKey,
          sortOrder: input.sortOrder,
          version: nextVersion,
          updatedAt: now,
        };

        await setDoc(doc(this.firestore, "rewards", id), updateData, { merge: true });
        await setDoc(doc(this.firestore, "adminRewardViews", id), {
          ...updateData,
          rewardId: id,
        }, { merge: true });

        const snap = await getDoc(doc(this.firestore, "adminRewardViews", id));
        if (snap.exists()) {
          return adminRewardViewToReward(decodeAdminRewardView({ rewardId: snap.id, ...snap.data() }));
        }
        return this.mapCanonicalRewardDocToReward(id, updateData);
      } catch {
        throw this.commandClient.mapFirebaseError(err, "adminUpdateReward");
      }
    }
  }

  async delete(id: string, expectedVersion?: number): Promise<void> {
    let ver = expectedVersion;
    if (ver === undefined) {
      try {
        const callable = httpsCallable<{ rewardId: string }, unknown>(
          this.functions,
          "getAdminReward"
        );
        const res = await callable({ rewardId: id });
        const view = decodeAdminRewardView(res.data);
        ver = view.version;
      } catch {
        try {
          const snap = await getDoc(doc(this.firestore, "adminRewardViews", id));
          if (snap.exists()) {
            ver = Number(snap.data()?.version ?? 1);
          }
        } catch { /* ignore */ }
      }
    }

    try {
      await this.commandClient.execute("adminDeleteUnusedReward", {
        rewardId: id,
        expectedVersion: ver,
      });
    } catch (err) {
      // Direct Firestore deletion fallback with reference fencing
      try {
        const vouchersSnap = await getDocs(collection(this.firestore, "vouchers"));
        const hasVoucher = vouchersSnap.docs.some((d) => d.data()?.rewardId === id);
        if (hasVoucher) {
          throw new Error("Reward has issued vouchers or redemptions and cannot be deleted. Deactivate it instead.");
        }

        await deleteDoc(doc(this.firestore, "adminRewardViews", id));
        await deleteDoc(doc(this.firestore, "rewards", id));
      } catch (directErr) {
        if (directErr instanceof Error && directErr.message.includes("Reward has issued vouchers")) {
          throw directErr;
        }
        throw this.commandClient.mapFirebaseError(err, "adminDeleteUnusedReward");
      }
    }
  }

  async listVouchers(query: VoucherListQuery): Promise<Page<ResidentVoucher>> {
    try {
      const snap = await getDocs(collection(this.firestore, "vouchers"));
      if (!snap.empty) {
        let vouchers: ResidentVoucher[] = snap.docs.map((d) => {
          const data = d.data();
          let issuedAt = new Date().toISOString();
          if (data.issuedAt) {
            if (typeof (data.issuedAt as { toDate?: () => Date }).toDate === "function") {
              issuedAt = (data.issuedAt as { toDate: () => Date }).toDate().toISOString();
            } else if (typeof data.issuedAt === "string") {
              issuedAt = data.issuedAt;
            }
          }
          let expiresAt = new Date().toISOString();
          if (data.expiresAt) {
            if (typeof (data.expiresAt as { toDate?: () => Date }).toDate === "function") {
              expiresAt = (data.expiresAt as { toDate: () => Date }).toDate().toISOString();
            } else if (typeof data.expiresAt === "string") {
              expiresAt = data.expiresAt;
            }
          }
          let usedAt: string | null = null;
          if (data.usedAt) {
            if (typeof (data.usedAt as { toDate?: () => Date }).toDate === "function") {
              usedAt = (data.usedAt as { toDate: () => Date }).toDate().toISOString();
            } else if (typeof data.usedAt === "string") {
              usedAt = data.usedAt;
            }
          }

          const rawStatus = String(data.status ?? "available");
          const status: VoucherStatus = (["available", "used", "expired"].includes(rawStatus)
            ? rawStatus
            : "unknown") as VoucherStatus;

          return {
            id: d.id,
            residentId: String(data.residentId ?? "unknown"),
            rewardId: data.rewardId ? String(data.rewardId) : null,
            title: String(data.title ?? "Reward Voucher"),
            merchantName: String(data.merchantName ?? data.merchant ?? "EcoLoop Partner"),
            code: String(data.code ?? d.id),
            terms: String(data.terms ?? ""),
            issuedAt,
            expiresAt,
            status,
            remainingUses: Number(data.remainingUses ?? (status === "used" ? 0 : 1)),
            usedAt,
          };
        });

        if (query.search && query.search.trim()) {
          const q = query.search.toLowerCase().trim();
          vouchers = vouchers.filter(
            (v) =>
              v.code.toLowerCase().includes(q) ||
              v.title.toLowerCase().includes(q) ||
              v.residentId.toLowerCase().includes(q) ||
              v.merchantName.toLowerCase().includes(q)
          );
        }

        if (query.status && query.status !== "all") {
          vouchers = vouchers.filter((v) => v.status === query.status);
        }

        vouchers.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

        const total = vouchers.length;
        const startIndex = (query.page - 1) * query.pageSize;
        const items = vouchers.slice(startIndex, startIndex + query.pageSize);

        return {
          items,
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      }
    } catch {
      // offline fallback below
    }

    if (this.fallbackRewardsRepo.listVouchers) {
      return await this.fallbackRewardsRepo.listVouchers(query);
    }

    return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
  }

  watchVouchers(query: VoucherListQuery): Observable<Page<ResidentVoucher>> {
    return {
      subscribe: (observer: Observer<Page<ResidentVoucher>>): Unsubscribe => {
        let isSubscribed = true;

        const load = () => {
          this.listVouchers(query)
            .then((page) => {
              if (isSubscribed) observer.next(page);
            })
            .catch(() => {
              if (isSubscribed) observer.next({ items: [], total: 0, page: query.page, pageSize: query.pageSize });
            });
        };

        load();

        const vouchersCol = collection(this.firestore, "vouchers");
        const unsubscribe = onSnapshot(
          vouchersCol,
          () => {
            if (isSubscribed) load();
          },
          () => {
            // Silently ignore snapshot errors
          }
        );

        return () => {
          isSubscribed = false;
          unsubscribe();
        };
      },
    };
  }
}
