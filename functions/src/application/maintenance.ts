import type { Instant } from "../domain/types.js";
import type { Dispatcher } from "../infrastructure/cloud_tasks.js";
import type { MaintenanceStore } from "../infrastructure/firestore/maintenance_store.js";

export async function reconcileMaintenance(
  store: MaintenanceStore,
  dispatcher: Dispatcher,
  now: Instant,
  limit = 50,
) {
  const dispatch = await dispatcher.reconcilePending(now, limit);
  const jobs = await store.reconcileJobs(now, limit);
  const reservationsExpired = await store.expireAbandonedReservations(now, limit);
  return { dispatch, ...jobs, reservationsExpired };
}
