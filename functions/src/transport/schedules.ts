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

export const runDailyMaintenance = onSchedule({
  schedule: "0 3 * * *",
  timeZone: "Asia/Kuala_Lumpur",
  region: process.env.ECOLOOP_TASKS_REGION ?? "asia-southeast1",
  timeoutSeconds: 120,
  memory: "256MiB",
  concurrency: 1,
  minInstances: 0,
  maxInstances: 1,
}, async () => {
  await getComposition().maintenance.runDaily(new Date().toISOString(), 50);
});
