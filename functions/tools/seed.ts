import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { imageSize } from "image-size";
import QRCode from "qrcode";
import { initialPolicy } from "../src/domain/policy.js";
import { referenceDocuments, type ReferenceDocument } from "./seed_reference_data.js";
import { EmulatorSeedTransport, GcloudSeedTransport, sha256, type SeedRecord, type SeedTransport, type StoredAsset } from "./seed_transport.js";

export type SeedMode = "dry-run" | "preview-live" | "verify-live" | "emulator" | "live";
interface SeedManifest {
  manifestVersion: string; seedId: string; policy: { id: string; version: string };
  bins: SeedRecord[]; extraQrCodes: SeedRecord[]; assets: SeedRecord[];
  rewardCategories: SeedRecord[]; rewards: SeedRecord[];
}
interface PreparedAsset { document: ReferenceDocument; bytes: Buffer; sourceRef: string; storagePath: string; mimeType: string }
interface QrEntry { qrId: string; binId: string; payload: string; displayName: string; enabled: boolean; file: string }
export interface SeedSummary {
  mode: SeedMode; seedId: string; projectId: string; databaseId: string; bucket: string;
  writes: string[]; preserved: string[]; conflicts: string[]; qrFiles: string[]; assetFiles: string[];
  assets: Array<{ id: string; storagePath: string; mimeType: string; bytes: number; generation: string | null; state: string }>;
  qrCodes: QrEntry[]; reportFile: string; verified: boolean;
}
interface SeedOptions { transport?: SeedTransport; outputDirectory?: string }

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultManifest = resolve(repositoryRoot, "functions/tools/seed-manifest.demo.json");
const defaultOutput = resolve(repositoryRoot, "functions/.seed-output/demo-v1");
const projectId = "ecoloop-thesmartrecycling";
const databaseId = "ecoloop-db";
const bucket = "ecoloop-thesmartrecycling.firebasestorage.app";

/** The suffix is a registered QR mapping ID; it need not equal the bin ID. */
export function qrPayloadForBin(qrId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(qrId)) throw new Error("Invalid QR ID");
  return `ecoloop://bin/${qrId}`;
}

export async function seed(mode: SeedMode = "dry-run", manifestPath = defaultManifest, firestore?: Firestore, options: SeedOptions = {}): Promise<SeedSummary> {
  if (!["dry-run", "preview-live", "verify-live", "emulator", "live"].includes(mode)) throw new Error("Unsupported seed mode");
  if (mode === "live" && process.env.ECOLOOP_SEED_LIVE !== "true") throw new Error("Live seeding requires ECOLOOP_SEED_LIVE=true");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as SeedManifest;
  validateManifest(manifest);
  const output = options.outputDirectory ?? defaultOutput;
  const now = Timestamp.now();
  const documents = makeDocuments(manifest, now);
  const assets = await Promise.all(manifest.assets.map(prepareAsset));
  documents.push(...assets.map((asset) => asset.document));
  const paths = documents.map((document) => document.path);
  if (new Set(paths).size !== paths.length || paths.length > 400) throw new Error("Seed document paths must be unique and bounded");
  let transport = options.transport;
  if (!transport && mode === "emulator") {
    if (!firestore) {
      const app = getApps().find((entry) => entry.name === "demo-reference-seed") ?? initializeApp({ projectId: "demo-ecoloop", storageBucket: "demo-ecoloop.appspot.com" }, "demo-reference-seed");
      firestore = getFirestore(app, databaseId);
    }
    if (firestore.databaseId !== databaseId) throw new Error("Seed emulator requires demo-ecoloop/ecoloop-db");
    const storageApp = getApps().find((entry) => entry.options.projectId === "demo-ecoloop" && entry.options.storageBucket === "demo-ecoloop.appspot.com");
    if (!storageApp) throw new Error("Demo Storage app configuration is required");
    transport = new EmulatorSeedTransport(firestore, storageApp);
  }
  if (!transport && ["preview-live", "verify-live", "live"].includes(mode)) {
    transport = new GcloudSeedTransport(projectId, databaseId, bucket);
  }
  const existing = transport ? await transport.read(paths) : new Map<string, SeedRecord>();
  const summary: SeedSummary = {
    mode, seedId: manifest.seedId, projectId: mode === "emulator" ? "demo-ecoloop" : projectId, databaseId,
    bucket: mode === "emulator" ? "demo-ecoloop.appspot.com" : bucket,
    writes: [], preserved: [], conflicts: [], qrFiles: [], assetFiles: [], assets: [], qrCodes: [],
    reportFile: resolve(output, `${mode}-report.json`), verified: false,
  };
  for (const document of documents) {
    const current = existing.get(document.path);
    if (!current) { summary.writes.push(document.path); continue; }
    summary.preserved.push(document.path);
    for (const field of document.immutableFields) {
      if (canonical(current[field]) !== canonical(document.data[field])) {
        summary.conflicts.push(`Immutable seed conflict at ${document.path}.${field}`);
      }
    }
  }
  // An existing bin with missing private state/cycle cannot be silently reset.
  for (const bin of manifest.bins) {
    const id = text(bin, "id");
    if (existing.has(`bins/${id}`)) {
      for (const path of [`binCycles/${id}-cycle-001`, `binOperations/${id}`]) {
        if (!existing.has(path)) summary.conflicts.push(`Existing bin needs operator reconciliation before creating ${path}`);
      }
    }
  }
  const stored = new Map<string, StoredAsset | null>();
  if (transport) {
    for (const asset of assets) {
      const current = await transport.inspectAsset(asset.storagePath);
      stored.set(asset.storagePath, current);
      if (current && (current.sha256 !== asset.document.data.contentSha256 || current.size !== asset.bytes.byteLength)) {
        summary.conflicts.push(`Storage content conflict at ${asset.storagePath}`);
      }
      const catalog = existing.get(asset.document.path);
      if (catalog && (!current || String(catalog.storageGeneration) !== current.generation)) {
        summary.conflicts.push(`Existing catalog generation is unavailable/changed at ${asset.document.path}`);
      }
    }
  }
  const applies = mode === "live" || mode === "emulator";
  if (summary.conflicts.length === 0 && applies) {
    if (!transport) throw new Error("Seed transport is required");
    // Store/check actual bytes first. Catalog is published only after generations exist.
    for (const asset of assets) {
      const saved = stored.get(asset.storagePath) ?? await transport.uploadAsset(asset.storagePath, asset.bytes, asset.mimeType);
      stored.set(asset.storagePath, saved);
      asset.document.data.storageGeneration = saved.generation;
    }
    await transport.create(documents.filter((document) => !existing.has(document.path)).map(({ path, data }) => ({
      path, data: { ...data, schemaVersion: "backend.v1", seedId: manifest.seedId, seededAt: now },
    })));
  }
  for (const asset of assets) {
    const saved = stored.get(asset.storagePath);
    summary.assets.push({ id: String(asset.document.data.id), storagePath: asset.storagePath, mimeType: asset.mimeType, bytes: asset.bytes.byteLength, generation: saved?.generation ?? null, state: saved ? "present_hash_checked" : "upload_required" });
    summary.assetFiles.push(asset.sourceRef);
  }
  if (summary.conflicts.length === 0 && (applies || mode === "verify-live") && transport) {
    const actual = await transport.read(paths);
    for (const document of documents) {
      const record = actual.get(document.path);
      if (!record) throw new Error(`Seed verification missing ${document.path}`);
      for (const field of document.immutableFields) {
        if (canonical(record[field]) !== canonical(document.data[field])) throw new Error(`Seed verification mismatch ${document.path}.${field}`);
      }
    }
    summary.verified = true;
  }
  await generateQrFiles(manifest, summary, output);
  await mkdir(output, { recursive: true });
  await writeFile(summary.reportFile, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  if (summary.conflicts.length) throw new Error(`No cloud writes performed: ${summary.conflicts.join("; ")}. Report: ${summary.reportFile}`);
  if (mode === "verify-live" && (summary.writes.length || summary.assets.some((asset) => asset.state === "upload_required"))) {
    throw new Error("Live seed verification found missing records/assets");
  }
  return summary;
}

function makeDocuments(manifest: SeedManifest, now: Timestamp): ReferenceDocument[] {
  const document = (path: string, data: SeedRecord, immutableFields: readonly string[] = Object.keys(data)): ReferenceDocument => ({ path, data, immutableFields });
  const policy = { ...initialPolicy(), ...manifest.policy };
  const result: ReferenceDocument[] = [
    document(`policies/${policy.id}`, policy),
    document("policyPointers/active", { policyId: policy.id, version: policy.version, updatedAt: now }, []),
    document("processingAvailability/global", { enabled: false, status: "paused", reason: "Backend refactor and end-to-end worker verification are required before processing is enabled.", configurationVersion: "demo-vision-v1", providerMode: "standard", updatedAt: now }, []),
    document("notificationDefaults/resident", { recyclingUpdates: true, pointsCredits: true, rewardReminders: true }),
    ...referenceDocuments(),
  ];
  for (const bin of manifest.bins) {
    const id = text(bin, "id");
    const cycleId = `${id}-cycle-001`;
    const opening = number(bin, "openingOccupiedSpc");
    const capacity = number(bin, "capacitySpc");
    result.push(
      document(`bins/${id}`, {
        id, displayName: bin.displayName, locationName: bin.displayName, locationDetail: bin.locationDetail,
        capacitySpc: capacity, occupiedSpc: opening, capacityPercent: Math.max(0, Math.min(100, Math.floor(opening * 100 / capacity))),
        cycleId, enabled: bin.enabled, isOnline: bin.isOnline, acceptedObjectClasses: policy.acceptedObjectClasses,
        acceptedMaterials: ["plastic", "aluminium", "glass", "paper"], sampleScenario: bin.sampleScenario,
        syntheticOpeningOccupancy: bin.syntheticOpeningOccupancy, availability: bin.enabled === false || bin.isOnline === false ? "unavailable" : opening >= capacity ? "full" : "available", updatedAt: now,
      }, ["id", "capacitySpc"]),
      document(`binCycles/${cycleId}`, { id: cycleId, binId: id, openingOccupiedSpc: opening, capacitySpc: capacity, contributionTotalSpc: 0, syntheticOpeningOccupancy: bin.syntheticOpeningOccupancy, startedAt: now, endedAt: null }, ["id", "binId", "capacitySpc"]),
      document(`binOperations/${id}`, { binId: id, ownerId: null, sessionId: null, phase: "available", simulatedAccess: "closed", expiresAt: null, version: 0, updatedAt: now }, ["binId"]),
      document(`binQrMappings/${text(bin, "qrId")}`, { id: bin.qrId, binId: id, qrPayload: qrPayloadForBin(text(bin, "qrId")), enabled: true, mappingVersion: 1 }, ["id", "binId", "qrPayload", "mappingVersion"]),
    );
  }
  for (const qr of manifest.extraQrCodes) {
    result.push(document(`binQrMappings/${text(qr, "id")}`, { id: qr.id, binId: qr.binId, qrPayload: qrPayloadForBin(text(qr, "id")), enabled: qr.enabled, mappingVersion: 1 }, ["id", "binId", "qrPayload", "mappingVersion"]));
  }
  for (const category of manifest.rewardCategories) result.push(document(`rewardCategories/${text(category, "id")}`, category));
  for (const reward of manifest.rewards) {
    const data = {
      ...reward, offerVersion: "demo-offer-v1", demoOnly: true, isDemo: true, isActive: true, imageUrl: null,
      maxRedemptionsPerResident: 1, voucherValidityDays: 30,
      catalogExpiresAt: Timestamp.fromDate(new Date("2027-12-31T23:59:59.000Z")),
      terms: "DEMONSTRATION ONLY. This generated single-use voucher is not a real merchant obligation and has no cash value. Valid for 30 days from issuance. Copying the code does not consume it; use the clearly labeled Simulate voucher use action. Unused expiry provides no points refund.",
    };
    result.push(document(`rewards/${text(reward, "id")}`, data));
  }
  return result;
}

async function prepareAsset(asset: SeedRecord): Promise<PreparedAsset> {
  const sourceRef = text(asset, "sourceRef");
  const source = isAbsolute(sourceRef) ? sourceRef : resolve(repositoryRoot, sourceRef);
  if (relative(repositoryRoot, source).startsWith("..")) throw new Error("Asset source must stay inside the repository");
  const bytes = await readFile(source);
  const geometry = imageSize(bytes);
  const formats: Record<string, { mimeType: string; extension: string }> = {
    jpg: { mimeType: "image/jpeg", extension: "jpg" }, png: { mimeType: "image/png", extension: "png" }, webp: { mimeType: "image/webp", extension: "webp" },
  };
  const format = formats[String(geometry.type)];
  if (!format || bytes.byteLength > 10485760 || geometry.width * geometry.height > 40_000_000) throw new Error(`Unsupported/oversized source pixels: ${sourceRef}`);
  const contentSha256 = sha256(bytes);
  const version = `sha256-${contentSha256.slice(0, 16)}`;
  const id = text(asset, "id");
  const storagePath = `simulation-assets/${id}/${version}/source.${format.extension}`;
  const data: SeedRecord = {
    id, displayName: text(asset, "displayName"), sortOrder: number(asset, "sortOrder"), enabled: true,
    version, storagePath, contentSha256, mimeType: format.mimeType, width: geometry.width, height: geometry.height, actualBytes: bytes.byteLength,
  };
  return { document: { path: `simulationAssets/${id}`, data, immutableFields: ["id", "version", "storagePath", "contentSha256", "mimeType", "width", "height", "actualBytes"] }, bytes, sourceRef, storagePath, mimeType: format.mimeType };
}

async function generateQrFiles(manifest: SeedManifest, summary: SeedSummary, output: string): Promise<void> {
  const qrDirectory = resolve(output, "qr");
  await mkdir(qrDirectory, { recursive: true });
  const qrCodes = [
    ...manifest.bins.map((bin) => ({ qrId: text(bin, "qrId"), binId: text(bin, "id"), displayName: text(bin, "displayName"), enabled: true })),
    ...manifest.extraQrCodes.map((qr) => ({ qrId: text(qr, "id"), binId: text(qr, "binId"), displayName: text(qr, "displayName"), enabled: qr.enabled === true })),
  ];
  const cards: string[] = [];
  for (const qr of qrCodes) {
    const file = resolve(qrDirectory, `${qr.qrId}.png`);
    const payload = qrPayloadForBin(qr.qrId);
    const bytes = await QRCode.toBuffer(payload, { type: "png", width: 1024, margin: 4, errorCorrectionLevel: "M" });
    await writeFile(file, bytes);
    summary.qrFiles.push(file);
    summary.qrCodes.push({ ...qr, payload, file });
    cards.push(`<section><h2>${escapeHtml(qr.displayName)}</h2><img src="data:image/png;base64,${bytes.toString("base64")}" alt="${escapeHtml(payload)}"><p>${escapeHtml(payload)}</p><p>Bin: ${escapeHtml(qr.binId)}${qr.enabled ? "" : " — disabled mapping test"}</p></section>`);
  }
  await writeFile(resolve(output, "PRINT_QR_CODES.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>EcoLoop registered bin QR codes</title><style>body{font:16px sans-serif}section{text-align:center;break-inside:avoid;page-break-after:always}img{width:100mm;height:100mm}p{overflow-wrap:anywhere}</style><h1>EcoLoop bin QR codes</h1><p>Cloud registration verified: ${summary.verified}. Main bin: qr-demo-main. Sample scenario labels are intentional.</p>${cards.join("\n")}</html>`, "utf8");
}

function validateManifest(manifest: SeedManifest): void {
  if (manifest.manifestVersion !== "seed.v2" || manifest.seedId !== "ecoloop-demo-reference-v1" || manifest.policy.id !== "policy-v1" || manifest.policy.version !== "policy-v1") throw new Error("Unsupported demo seed manifest/policy");
  for (const field of ["bins", "assets", "rewardCategories", "rewards", "extraQrCodes"] as const) {
    if (!Array.isArray(manifest[field])) throw new Error(`Manifest ${field} must be an array`);
    const ids = manifest[field].map((entry) => text(entry, "id"));
    if (new Set(ids).size !== ids.length || ids.some((id) => !/^[a-z0-9][a-z0-9._-]{0,100}$/.test(id))) throw new Error(`Invalid/duplicate IDs in ${field}`);
  }
  if (manifest.bins.length < 1 || manifest.assets.length < 1 || manifest.rewards.length !== 4) throw new Error("Manifest requires actual bins, images and all four rewards");
  for (const bin of manifest.bins) {
    const capacity = number(bin, "capacitySpc"); const opening = number(bin, "openingOccupiedSpc");
    if (capacity <= 0 || opening < 0 || opening > capacity || typeof bin.enabled !== "boolean" || typeof bin.isOnline !== "boolean") throw new Error(`Invalid bin configuration: ${text(bin, "id")}`);
    qrPayloadForBin(text(bin, "qrId"));
  }
}

function text(value: SeedRecord, key: string): string {
  if (typeof value[key] !== "string" || !value[key]) throw new Error(`Missing string ${key}`);
  return value[key] as string;
}
function number(value: SeedRecord, key: string): number {
  if (typeof value[key] !== "number" || !Number.isSafeInteger(value[key])) throw new Error(`Missing integer ${key}`);
  return value[key] as number;
}
function canonical(value: unknown): string {
  if (value instanceof Timestamp) return JSON.stringify(value.toDate().toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map(process.argv.slice(2).map((argument) => { const [key, ...rest] = argument.replace(/^--/, "").split("="); return [key, rest.join("=")]; }));
  const mode = (args.get("mode") ?? "dry-run") as SeedMode;
  if (["live", "preview-live", "verify-live"].includes(mode) &&
      (args.get("project") !== projectId || args.get("database") !== databaseId || args.get("bucket") !== bucket)) {
    console.error("Live-target modes require explicit --project, --database and --bucket matching the verified project");
    process.exitCode = 1;
  } else {
    seed(mode, args.get("manifest") ? resolve(args.get("manifest")!) : defaultManifest).then((summary) => console.log(JSON.stringify(summary, null, 2))).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Seed failed"); process.exitCode = 1;
    });
  }
}
