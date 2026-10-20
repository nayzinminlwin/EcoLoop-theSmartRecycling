import { onSchedule } from "firebase-functions/v2/scheduler";
import { getComposition } from "../composition.js";

export const dispatchPendingNotifications = onSchedule({
  schedule: "every 1 minutes",
  region: process.env.ECOLOOP_TASKS_REGION ?? "asia-southeast1",
  timeoutSeconds: 60,
  memory: "256MiB",
}, async () => {
  await getComposition().notificationDispatcher.dispatchPending(new Date().toISOString());
});
