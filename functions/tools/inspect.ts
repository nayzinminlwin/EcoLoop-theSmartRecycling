import { getApps, initializeApp } from "firebase-admin/app";
import { createComposition } from "../src/composition.js";

const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, "").split("=");
  return [key, value.join("=")];
}));
const projectId = args.get("project") ?? process.env.GCLOUD_PROJECT ?? "demo-ecoloop";
const batchId = args.get("batch-id");
const sessionId = args.get("session-id");
const jobId = args.get("job-id");
const residentId = args.get("resident-id");
const limit = Number(args.get("limit") ?? 50);
if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("--limit must be between 1 and 100");
if (batchId === undefined && sessionId === undefined && jobId === undefined && residentId === undefined) {
  throw new Error("Use --session-id, --batch-id, --job-id, or --resident-id");
}
process.env.GCLOUD_PROJECT = projectId;
if (args.get("environment") !== "live") process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
if (getApps().length === 0) initializeApp({ projectId });
const composition = createComposition();
const report = await composition.maintenance.inspect({
  ...(batchId === undefined ? {} : { batchId }),
  ...(sessionId === undefined ? {} : { sessionId }),
  ...(jobId === undefined ? {} : { jobId }),
  ...(residentId === undefined ? {} : { residentId }),
  limit,
  now: new Date().toISOString(),
});
console.log(JSON.stringify(report, null, 2));
