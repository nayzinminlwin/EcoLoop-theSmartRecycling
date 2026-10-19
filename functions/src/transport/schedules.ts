import { onSchedule } from "firebase-functions/v2/scheduler";
import { reconcileMaintenance } from "../application/maintenance.js";
import { createDispatchConfig, CloudTasksDispatcher } from "../infrastructure/cloud_tasks.js";
import { getComposition } from "../composition.js";

export const reconcileBackendState = onSchedule({
  schedule: "every 1 minutes",
  region: process.env.ECOLOOP_TASKS_REGION ?? "asia-southeast1",
  timeoutSeconds: 60,
  memory: "256MiB",
}, async () => {
  const composition = getComposition();
  const dispatcher = new CloudTasksDispatcher(composition.firestore, createDispatchConfig());
  await reconcileMaintenance(composition.maintenance, dispatcher, new Date().toISOString());
});
