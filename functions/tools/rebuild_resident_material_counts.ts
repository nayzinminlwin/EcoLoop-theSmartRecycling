import { getApps, initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";
import {
  acceptedItemCountsFromLines,
  emptyAcceptedItemCounts,
  type AcceptedItemCounts,
} from "../src/domain/material_counts.js";
import type { CanonicalClass, ReceiptLine } from "../src/domain/types.js";

const MATERIAL_WEIGHTS_KG = {
  plastic: 0.025,
  aluminium: 0.015,
  paper: 0.05,
  glass: 0.2,
} as const;
const DEFAULT_PROJECT_ID = "demo-ecoloop";
const DEFAULT_DATABASE_ID = "ecoloop-db";
const PAGE_SIZE = 100;
const MAX_RETRIES = 3;

const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, "").split("=");
  return [key, value.join("=")];
}));
const projectId = args.get("project") ?? process.env.GCLOUD_PROJECT ?? DEFAULT_PROJECT_ID;
const databaseId = args.get("database") ?? process.env.ECOLOOP_FIRESTORE_DATABASE ?? DEFAULT_DATABASE_ID;
const residentId = args.get("resident-id");
const preview = args.get("preview") !== "false";
const environment = args.get("environment") ?? "emulator";

if (environment !== "live") process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = projectId;
const app = getApps()[0] ?? initializeApp({ projectId });
const firestore = getFirestore(app, databaseId);

if (residentId !== undefined && residentId.trim() === "") {
  throw new Error("--resident-id must not be empty");
}

const residentIds = residentId === undefined
  ? await readResidentIds(firestore)
  : [residentId];
const reports = [];
for (const id of residentIds) {
  reports.push(await rebuildResident(firestore, id, preview));
}
console.log(JSON.stringify({
  mode: preview ? "preview" : "apply",
  projectId,
  databaseId,
  residents: reports,
}, null, 2));

async function readResidentIds(firestore: Firestore): Promise<string[]> {
  const ids: string[] = [];
  let page = await firestore.collection("residents").limit(PAGE_SIZE).get();
  while (!page.empty) {
    ids.push(...page.docs.map((document) => document.id));
    if (page.size < PAGE_SIZE) break;
    page = await firestore.collection("residents")
      .startAfter(page.docs[page.docs.length - 1])
      .limit(PAGE_SIZE)
      .get();
  }
  return ids;
}

async function rebuildResident(firestore: Firestore, residentId: string, preview: boolean): Promise<ResidentReport> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const statsRef = firestore.doc(`residents/${residentId}/stats/current`);
    const statsSnapshot = await statsRef.get();
    const history = await readVerifiedHistory(firestore, residentId);
    const report = buildReport(residentId, statsSnapshot, history);
    if (preview) return report;

    try {
      await firestore.runTransaction(async (transaction) => {
        const currentStats = await transaction.get(statsRef);
        if (currentStats.updateTime?.toMillis() !== statsSnapshot.updateTime?.toMillis()) {
          throw new RetryableConflict();
        }
        if (!currentStats.exists) {
          throw new Error(`Stats document does not exist for resident ${residentId}`);
        }
        transaction.update(statsRef, {
          acceptedItemCounts: report.reconstructedCounts,
          updatedAt: new Date().toISOString(),
        });
      });
      return { ...report, applied: true, retryCount: attempt - 1 };
    } catch (error) {
      if (!(error instanceof RetryableConflict) || attempt === MAX_RETRIES) throw error;
    }
  }
  throw new Error(`Unable to rebuild resident ${residentId}`);
}

async function readVerifiedHistory(firestore: Firestore, residentId: string): Promise<HistoryResult> {
  const counts = emptyAcceptedItemCounts();
  const missingMaterialDetails: string[] = [];
  const unsupportedLines: string[] = [];
  let verifiedBatchCount = 0;
  let lastDocument: DocumentSnapshot<DocumentData> | undefined;

  while (true) {
    let query = firestore.collection("deposits")
      .where("ownerId", "==", residentId)
      .limit(PAGE_SIZE);
    if (lastDocument !== undefined) query = query.startAfter(lastDocument);
    const page = await query.get();
    if (page.empty) break;

    for (const document of page.docs) {
      const data = document.data();
      if (data.status !== "verified") continue;
      verifiedBatchCount += 1;
      if (!Array.isArray(data.lines) || data.lines.length === 0) {
        missingMaterialDetails.push(document.id);
        continue;
      }

      const lines: ReceiptLine[] = [];
      for (const rawLine of data.lines) {
        const lineId = lineIdOf(rawLine);
        if (!isReceiptLine(rawLine) || !isMaterialClass(rawLine.class)) {
          unsupportedLines.push(`${document.id}:${lineId}`);
          continue;
        }
        lines.push(rawLine);
      }
      addCounts(counts, acceptedItemCountsFromLines(lines));
    }

    if (page.size < PAGE_SIZE) break;
    lastDocument = page.docs[page.docs.length - 1];
  }

  return { counts, verifiedBatchCount, missingMaterialDetails, unsupportedLines };
}

function buildReport(
  residentId: string,
  statsSnapshot: DocumentSnapshot<DocumentData>,
  history: HistoryResult,
): ResidentReport {
  const stored = statsSnapshot.data()?.acceptedItemCounts;
  const storedCounts = isAcceptedItemCounts(stored) ? stored : null;
  const discrepancies: string[] = [];
  if (!statsSnapshot.exists) {
    discrepancies.push("stats document does not exist");
  }
  const storedVerifiedBatchCount = number(statsSnapshot.data()?.verifiedBatchCount);
  if (storedVerifiedBatchCount !== history.verifiedBatchCount) {
    discrepancies.push(
      `verifiedBatchCount differs: stats=${storedVerifiedBatchCount}, history=${history.verifiedBatchCount}`,
    );
  }
  if (history.missingMaterialDetails.length > 0) {
    discrepancies.push(`${history.missingMaterialDetails.length} verified deposits have missing material details`);
  }
  if (history.unsupportedLines.length > 0) {
    discrepancies.push(`${history.unsupportedLines.length} receipt lines are malformed or unsupported`);
  }

  return {
    residentId,
    statsExists: statsSnapshot.exists,
    storedCounts,
    reconstructedCounts: history.counts,
    derivedWeightKg: weightKg(history.counts),
    verifiedBatchCount: history.verifiedBatchCount,
    missingMaterialDetails: history.missingMaterialDetails,
    unsupportedLines: history.unsupportedLines,
    discrepancies,
    applied: false,
    retryCount: 0,
  };
}

function isReceiptLine(value: unknown): value is ReceiptLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return typeof line.lineId === "string" &&
    isCanonicalClass(line.class) &&
    typeof line.eligible === "boolean" &&
    typeof line.count === "number" &&
  Number.isInteger(line.count) &&
  line.count >= 0;
}

function isCanonicalClass(value: unknown): value is CanonicalClass {
  return [
    "plastic_bottle",
    "aluminium_can",
    "glass_bottle",
    "paper_item",
    "paper_bag",
    "cardboard_item",
    "other",
    "unknown",
  ].includes(value as CanonicalClass);
}

function isMaterialClass(value: CanonicalClass): boolean {
  return value === "plastic_bottle" ||
    value === "aluminium_can" ||
    value === "glass_bottle" ||
    value === "paper_item" ||
    value === "paper_bag";
}

function lineIdOf(value: unknown): string {
  const lineId = typeof value === "object" && value !== null
    ? (value as Record<string, unknown>).lineId
    : undefined;
  if (typeof lineId === "string") {
    return lineId;
  }
  return "unknown";
}

function isAcceptedItemCounts(value: unknown): value is AcceptedItemCounts {
  if (typeof value !== "object" || value === null) return false;
  const counts = value as Record<string, unknown>;
  return Object.keys(MATERIAL_WEIGHTS_KG).every(
    (key) => typeof counts[key] === "number" && Number.isFinite(counts[key]),
  );
}

function addCounts(target: AcceptedItemCounts, additions: AcceptedItemCounts): void {
  target.plastic += additions.plastic;
  target.aluminium += additions.aluminium;
  target.paper += additions.paper;
  target.glass += additions.glass;
}

function weightKg(counts: AcceptedItemCounts): number {
  return Object.entries(MATERIAL_WEIGHTS_KG).reduce(
    (total, [material, weight]) => total + counts[material as keyof AcceptedItemCounts] * weight,
    0,
  );
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

interface HistoryResult {
  readonly counts: AcceptedItemCounts;
  readonly verifiedBatchCount: number;
  readonly missingMaterialDetails: readonly string[];
  readonly unsupportedLines: readonly string[];
}

interface ResidentReport {
  readonly residentId: string;
  readonly statsExists: boolean;
  readonly storedCounts: AcceptedItemCounts | null;
  readonly reconstructedCounts: AcceptedItemCounts;
  readonly derivedWeightKg: number;
  readonly verifiedBatchCount: number;
  readonly missingMaterialDetails: readonly string[];
  readonly unsupportedLines: readonly string[];
  readonly discrepancies: readonly string[];
  readonly applied: boolean;
  readonly retryCount: number;
}

class RetryableConflict extends Error {}
