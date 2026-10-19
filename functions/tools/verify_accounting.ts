import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";

const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, "").split("=");
  return [key, value.join("=")];
}));

const projectId = args.get("project") ?? process.env.GCLOUD_PROJECT ?? "demo-ecoloop";
const residentId = args.get("resident-id");
if (residentId === undefined || residentId.trim() === "") {
  throw new Error("Use --resident-id=<resident-id>");
}
const fixturePath = args.get("fixture");
if (fixturePath !== undefined) {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture;
  console.log(JSON.stringify(buildReport(projectId, residentId, fixture.wallet, fixture.entries, fixture.deposits), null, 2));
  process.exit(0);
}
process.env.GCLOUD_PROJECT = projectId;
if (args.get("environment") !== "live") process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const app = getApps()[0] ?? initializeApp({ projectId });

const firestore = getFirestore(app, process.env.ECOLOOP_FIRESTORE_DATABASE ?? "ecoloop-db");
const [walletSnapshot, entriesSnapshot, depositsSnapshot] = await Promise.all([
  firestore.doc(`residents/${residentId}/wallet/current`).get(),
  firestore.collection("walletEntries").where("residentId", "==", residentId).get(),
  firestore.collection("deposits").where("ownerId", "==", residentId).get(),
]);

const wallet = walletSnapshot.data() ?? {};
const entries = entriesSnapshot.docs.map((document) => document.data());
const deposits = depositsSnapshot.docs.map((document) => document.data());
console.log(JSON.stringify(buildReport(projectId, residentId, wallet, entries, deposits), null, 2));

function buildReport(
  projectId: string,
  residentId: string,
  wallet: Record<string, unknown>,
  entries: readonly Record<string, unknown>[],
  deposits: readonly Record<string, unknown>[],
) {
  const ledgerBalance = entries.reduce((total, entry) => total + number(entry.pointsDelta), 0);
  const creditedDeposits = deposits.reduce((total, deposit) => total + number(deposit.pointsAwarded), 0);
  const discrepancies: string[] = [];
  if (number(wallet.balance) < 0) discrepancies.push("wallet balance is negative");
  if (ledgerBalance !== number(wallet.balance) - number(wallet.openingBalance)) {
    discrepancies.push("wallet balance does not reconcile with wallet entries");
  }
  if (creditedDeposits !== entries
    .filter((entry) => entry.type === "deposit_credit" && entry.sourceType === "deposit")
    .reduce((total, entry) => total + number(entry.pointsDelta), 0)) {
    discrepancies.push("deposit credits do not reconcile with deposit records");
  }

  return {
    mode: "readonly",
    projectId,
    residentId,
    wallet: { balance: number(wallet.balance), version: number(wallet.version) },
    counts: { walletEntries: entries.length, deposits: deposits.length },
    totals: { ledgerBalance, creditedDeposits },
    discrepancies,
  };
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

interface Fixture {
  readonly wallet: Record<string, unknown>;
  readonly entries: readonly Record<string, unknown>[];
  readonly deposits: readonly Record<string, unknown>[];
}
