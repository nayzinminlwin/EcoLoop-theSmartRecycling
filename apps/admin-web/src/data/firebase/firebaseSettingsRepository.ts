// =============================================================================
// firebaseSettingsRepository.ts — Firebase-backed SettingsRepository
// Phase AB-05 — Immutable program settings and future-policy publication
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  doc,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import type {
  SettingsRepository,
  Observable,
  Observer,
  Unsubscribe,
} from "../repositories.ts";
import type {
  AdminSettings,
  SettingsInput,
} from "../../contracts/admin.ts";
import type { FirebaseCommandClient } from "../../core/firebase/commandClient.ts";

export class FirebaseSettingsRepository implements SettingsRepository {
  private readonly functions: Functions;
  private readonly firestore: Firestore;
  private readonly commandClient: FirebaseCommandClient;
  private readonly fallbackSettingsRepo: SettingsRepository;

  constructor(
    functions: Functions,
    firestore: Firestore,
    commandClient: FirebaseCommandClient,
    fallbackSettingsRepo: SettingsRepository
  ) {
    this.functions = functions;
    this.firestore = firestore;
    this.commandClient = commandClient;
    this.fallbackSettingsRepo = fallbackSettingsRepo;
  }

  async get(): Promise<AdminSettings> {
    try {
      const callable = httpsCallable<void, AdminSettings>(
        this.functions,
        "getAdminSettings"
      );
      const res = await callable();
      return res.data;
    } catch (err) {
      if (this.fallbackSettingsRepo) {
        try {
          return await this.fallbackSettingsRepo.get();
        } catch {
          // ignore fallback error and throw mapped original error
        }
      }
      throw this.commandClient.mapFirebaseError(err, "getAdminSettings");
    }
  }

  watch(): Observable<AdminSettings> {
    return {
      subscribe: (observer: Observer<AdminSettings>): Unsubscribe => {
        let isUnsubscribed = false;

        // Emit initial value
        this.get()
          .then((data) => {
            if (!isUnsubscribed) observer.next(data);
          })
          .catch((err) => {
            if (!isUnsubscribed) {
              const mapped = this.commandClient.mapFirebaseError(err, "getAdminSettings");
              observer.error(mapped.failure);
            }
          });

        // Watch settings doc and read-version topic revision
        const settingsDocRef = doc(this.firestore, "adminSettings/global");
        const readVersionRef = doc(this.firestore, "adminReadVersions/settings");

        let fetchInFlight = false;
        const triggerRefresh = () => {
          if (isUnsubscribed || fetchInFlight) return;
          fetchInFlight = true;
          this.get()
            .then((data) => {
              fetchInFlight = false;
              if (!isUnsubscribed) observer.next(data);
            })
            .catch((err) => {
              fetchInFlight = false;
              if (!isUnsubscribed) {
                const mapped = this.commandClient.mapFirebaseError(err, "getAdminSettings");
                observer.error(mapped.failure);
              }
            });
        };

        const unsubSettings = onSnapshot(
          settingsDocRef,
          () => triggerRefresh(),
          (err) => {
            if (!isUnsubscribed) {
              const mapped = this.commandClient.mapFirebaseError(err, "watchSettings");
              observer.error(mapped.failure);
            }
          }
        );

        const unsubVersion = onSnapshot(
          readVersionRef,
          () => triggerRefresh(),
          () => {
            // Silently swallow read-version permission/connectivity warnings if settings doc is sufficient
          }
        );

        return () => {
          isUnsubscribed = true;
          unsubSettings();
          unsubVersion();
        };
      },
    };
  }

  async update(input: SettingsInput): Promise<AdminSettings> {
    try {
      let expectedVersion = input.expectedVersion;
      if (expectedVersion === undefined) {
        const current = await this.get();
        expectedVersion = current.version ?? 1;
      }

      // If acceptedClasses not explicitly passed, derive from acceptedMaterials
      const acceptedClasses = input.acceptedClasses ?? [
        ...(input.acceptedMaterials.includes("plastic") ? ["plastic_bottle"] : []),
        ...(input.acceptedMaterials.includes("aluminium") ? ["aluminium_can"] : []),
        ...(input.acceptedMaterials.includes("glass") ? ["glass_bottle"] : []),
        ...(input.acceptedMaterials.includes("paper") ? ["paper_item", "paper_bag"] : []),
      ];

      const materialRates = input.materialRates.map((mr) => ({
        materialType: mr.materialType,
        pointsPerItem: mr.pointsPerItem,
        eligible: mr.eligible,
      }));

      await this.commandClient.execute("adminPublishSettings", {
        expectedVersion,
        capacityAlertThreshold: input.capacityAlertThreshold,
        acceptedClasses,
        materialRates,
      });

      return await this.get();
    } catch (err) {
      throw this.commandClient.mapFirebaseError(err, "adminPublishSettings");
    }
  }
}
