import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createComposition } from "../src/composition.js";

type Environment = "emulator" | "live";

const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, "").split("=");
  return [key, value.join("=")];
}));
const environment = (args.get("environment") ?? "emulator") as Environment;
const projectId = args.get("project") ?? (environment === "emulator" ? "demo-ecoloop" : process.env.GCLOUD_PROJECT);
const runId = args.get("run-id") ?? `operator-${Date.now()}`;
const actorId = args.get("actor-id") ?? process.env.USERNAME ?? "operator";
const binId = args.get("bin-id");
const expectedCycleId = args.get("expected-cycle-id");

if (environment !== "emulator" && environment !== "live") throw new Error("--environment must be emulator or live");
if (projectId === undefined || projectId.trim() === "") throw new Error("--project is required");
if (binId === undefined || expectedCycleId === undefined) {
  throw new Error("--bin-id and --expected-cycle-id are required");
}
if (environment === "live" && process.env.ECOLOOP_OPERATOR_LIVE !== "true") {
  throw new Error("Live operator use requires ECOLOOP_OPERATOR_LIVE=true");
}

if (environment === "emulator") {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
}
process.env.GCLOUD_PROJECT = projectId;
if (getApps().length === 0) initializeApp({ projectId });
const composition = createComposition();
const result = await composition.maintenance.recordCollection({
  binId, expectedCycleId, actorId, environment, runId, now: new Date().toISOString(),
});
console.log(JSON.stringify({ projectId, runId, ...result }));
