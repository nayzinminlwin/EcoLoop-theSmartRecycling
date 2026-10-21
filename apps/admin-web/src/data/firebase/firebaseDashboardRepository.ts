// =============================================================================
// firebaseDashboardRepository.ts — Firebase-backed DashboardRepository
// Phase AB-09 — Live metrics, cross-client convergence, and visibility pause/resume
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  doc,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import type {
  DashboardRepository,
  Observable,
  Observer,
  Unsubscribe,
} from "../repositories.ts";
import type { DashboardSummary } from "../../contracts/admin.ts";
import {
  decodeAdminDashboardView,
  adminDashboardViewToSummary,
} from "../../contracts/adminViewCodecs.ts";
import type { FirebaseCommandClient } from "../../core/firebase/commandClient.ts";

export class FirebaseDashboardRepository implements DashboardRepository {
  private readonly functions: Functions;
  private readonly firestore: Firestore;
  private readonly commandClient: FirebaseCommandClient;
  private readonly fallbackDashboardRepo: DashboardRepository;

  constructor(
    functions: Functions,
    firestore: Firestore,
    commandClient: FirebaseCommandClient,
    fallbackDashboardRepo: DashboardRepository
  ) {
    this.functions = functions;
    this.firestore = firestore;
    this.commandClient = commandClient;
    this.fallbackDashboardRepo = fallbackDashboardRepo;
  }

  async getSummary(): Promise<DashboardSummary> {
    try {
      const callable = httpsCallable<Record<string, unknown>, unknown>(
        this.functions,
        "getAdminDashboard"
      );
      const res = await callable({});
      const decoded = decodeAdminDashboardView(res.data);
      return adminDashboardViewToSummary(decoded);
    } catch {
      return await this.fallbackDashboardRepo.getSummary();
    }
  }

  watchSummary(): Observable<DashboardSummary> {
    return {
      subscribe: (observer: Observer<DashboardSummary>): Unsubscribe => {
        let isSubscribed = true;
        let isTabHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
        let pendingRefresh = false;

        const load = () => {
          if (!isSubscribed) return;
          if (isTabHidden) {
            pendingRefresh = true;
            return;
          }

          pendingRefresh = false;
          this.getSummary()
            .then((summary) => {
              if (isSubscribed) observer.next(summary);
            })
            .catch((err) => {
              if (isSubscribed) {
                observer.error(this.commandClient.mapFirebaseError(err, "getAdminDashboard").failure);
              }
            });
        };

        // Initial fetch
        load();

        // Realtime invalidation listener on adminReadVersions/dashboard
        const versionDocRef = doc(this.firestore, "adminReadVersions/dashboard");
        const unsubscribeSnapshot = onSnapshot(
          versionDocRef,
          () => {
            if (isSubscribed) load();
          },
          () => {
            // Silently maintain current data on connection drops
          }
        );

        // Visibility handling: pause while hidden, revalidate on foreground
        const handleVisibilityChange = () => {
          if (typeof document === "undefined") return;
          isTabHidden = document.visibilityState === "hidden";
          if (!isTabHidden && pendingRefresh) {
            load();
          }
        };

        if (typeof document !== "undefined") {
          document.addEventListener("visibilitychange", handleVisibilityChange);
        }

        return () => {
          isSubscribed = false;
          unsubscribeSnapshot();
          if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
          }
        };
      },
    };
  }
}
