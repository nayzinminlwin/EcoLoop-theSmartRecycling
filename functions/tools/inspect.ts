import { getApps, initializeApp } from "firebase-admin/app";
import { createComposition } from "../src/composition.js";

const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, "").split("=");
  return [key, value.join("=")];
}));
const projectId = args.get("project") ?? process.env.GCLOUD_PROJECT ?? "demo-ecoloop";
const batchId = args.get("batch-id");
const residentId = args.get("resident-id");
if (batchId === undefined && residentId === undefined) throw new Error("Use --batch-id or --resident-id");
process.env.GCLOUD_PROJECT = projectId;
if (args.get("environment") !== "live") process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
if (getApps().length === 0) initializeApp({ projectId });
const composition = createComposition();
const report = await composition.maintenance.inspect({
  ...(batchId === undefined ? {} : { batchId }),
  ...(residentId === undefined ? {} : { residentId }),
  now: new Date().toISOString(),
});
console.log(JSON.stringify(report, null, 2));
