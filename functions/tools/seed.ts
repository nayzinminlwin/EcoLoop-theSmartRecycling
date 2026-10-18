import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { imageSize } from "image-size";
import QRCode from "qrcode";
import { initialPolicy } from "../src/domain/policy.js";

type SeedMode = "dry-run" | "emulator" | "live";
type JsonObject = Record<string, unknown>;

interface SeedManifest {
  readonly manifestVersion: string;
  readonly fixturePrefix: string;
  readonly policy: JsonObject;
  readonly bins: readonly JsonObject[];
  readonly assets: readonly JsonObject[];
  readonly rewardCategories: readonly JsonObject[];
  readonly rewards: readonly JsonObject[];
}

export interface SeedSummary {
  readonly mode: SeedMode;
  readonly writes: readonly string[];
  readonly qrFiles: readonly string[];
  readonly assetFiles: readonly string[];
}

export function qrPayloadForBin(binId: string): string {
  return `ecoloop://bin/${binId}`;
}

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const defaultManifest = resolve(toolDirectory, "seed-manifest.example.json");
const repositoryRoot = resolve(toolDirectory, "../..");
const outputDirectory = resolve(repositoryRoot, "functions/.seed-output");
const immutableFields = ["id", "version", "contentSha256", "capacitySpc", "cycleId"] as const;

export async function seed(
  mode: SeedMode = "dry-run",
  manifestPath = defaultManifest,
  firestore?: Firestore,
): Promise<SeedSummary> {
  if (mode === "live" && process.env.ECOLOOP_SEED_LIVE !== "true") {
    throw new Error("Live seeding requires ECOLOOP_SEED_LIVE=true");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as SeedManifest;
  validateManifest(manifest);
  const writes: string[] = [];
  const qrFiles: string[] = [];
  const assetFiles: string[] = [];
  const db = mode === "dry-run" ? undefined : firestore ?? createFirestore(mode);
  const now = new Date().toISOString();

  const policy = {
    ...initialPolicy(),
    ...manifest.policy,
    seededAt: now,
    seedFixture: manifest.fixturePrefix,
  };
  await writeDocument(db, "policies", String(policy.id), policy, writes);
  await writeDocument(db, "policyPointers", "active", {
    policyId: policy.id,
    version: manifest.policy.version,
    seedFixture: manifest.fixturePrefix,
    updatedAt: now,
  }, writes);

  for (const bin of manifest.bins) {
    const binId = stringField(bin, "id");
    const cycleId = `${binId}-cycle-001`;
    const capacity = numberField(bin, "capacitySpc");
    const opening = numberField(bin, "openingOccupiedSpc");
    await writeDocument(db, "binCycles", cycleId, {
      id: cycleId,
      binId,
      openingOccupiedSpc: opening,
      capacitySpc: capacity,
      seededOpeningOccupancy: true,
      startedAt: now,
      seedFixture: manifest.fixturePrefix,
    }, writes, ["id", "capacitySpc"]);
    await writeDocument(db, "bins", binId, {
      ...bin,
      cycleId,
      occupiedSpc: opening,
      capacityPercent: Math.round((opening / capacity) * 100),
      capacitySpc: capacity,
      isOnline: true,
      enabled: true,
      updatedAt: now,
      seedFixture: manifest.fixturePrefix,
    }, writes, ["id", "capacitySpc", "cycleId"]);
    await writeDocument(db, "binQrMappings", binId, {
      id: binId,
      binId,
      qrPayload: qrPayloadForBin(binId),
      enabled: true,
      seedFixture: manifest.fixturePrefix,
    }, writes, ["id"]);
    const qrPath = resolve(outputDirectory, `qr-${binId}.png`);
    await mkdir(dirname(qrPath), { recursive: true });
    await QRCode.toFile(qrPath, qrPayloadForBin(binId), { type: "png", width: 512 });
    qrFiles.push(qrPath);
  }

  for (const asset of manifest.assets) {
    const assetId = stringField(asset, "id");
    const sourcePath = resolveSource(stringField(asset, "sourceRef"));
    const bytes = await readFile(sourcePath);
    const contentSha256 = createHash("sha256").update(bytes).digest("hex");
    const dimensions = imageSize(bytes);
    const mimeType = mimeFromPath(sourcePath);
    const version = `sha256-${contentSha256.slice(0, 16)}`;
    const storagePath = `simulation-assets/${assetId}/${version}/${sourcePath.split(/[\\/]/).pop()}`;
    await writeDocument(db, "simulationAssets", assetId, {
      ...asset,
      id: assetId,
      version,
      sourceRef: stringField(asset, "sourceRef"),
      storagePath,
      contentSha256,
      mimeType,
      width: dimensions.width,
      height: dimensions.height,
      actualBytes: bytes.byteLength,
      seedFixture: manifest.fixturePrefix,
    }, writes, ["id", "version", "contentSha256"]);
    const localAssetPath = resolve(outputDirectory, sourcePath.split(/[\\/]/).pop()!);
    await mkdir(dirname(localAssetPath), { recursive: true });
    await writeFile(localAssetPath, bytes);
    assetFiles.push(localAssetPath);
    if (db !== undefined && mode !== "dry-run") {
      const bucket = getStorage(getApps()[0]).bucket();
      await bucket.upload(sourcePath, {
        destination: storagePath,
        metadata: { contentType: mimeType, metadata: { assetId, version, contentSha256 } },
      });
    }
  }

  for (const category of manifest.rewardCategories) {
    await writeDocument(db, "rewardCategories", stringField(category, "id"), {
      ...category,
      seedFixture: manifest.fixturePrefix,
    }, writes, ["id"]);
  }
  for (const reward of manifest.rewards) {
    await writeDocument(db, "rewards", stringField(reward, "id"), {
      ...reward,
      seedFixture: manifest.fixturePrefix,
    }, writes, ["id", "offerVersion"]);
  }
  return { mode, writes, qrFiles, assetFiles };
}

async function writeDocument(
  db: Firestore | undefined,
  collection: string,
  id: string,
  value: JsonObject,
  writes: string[],
  conflictFields: readonly string[] = immutableFields,
): Promise<void> {
  const path = `${collection}/${id}`;
  if (db === undefined) {
    writes.push(path);
    return;
  }
  const ref = db.doc(path);
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data() ?? {};
    for (const field of conflictFields) {
      if (data[field] !== undefined && value[field] !== undefined &&
          JSON.stringify(data[field]) !== JSON.stringify(value[field])) {
        throw new Error(`Immutable seed conflict at ${path}.${field}`);
      }
    }
    await ref.set(value, { merge: true });
  } else {
    await ref.create(value);
  }
  writes.push(path);
}

function validateManifest(manifest: SeedManifest): void {
  if (manifest.manifestVersion !== "seed.v1") throw new Error("Unsupported seed manifest version");
  if (manifest.bins.length < 3) throw new Error("Seed manifest requires normal, near-full and full bins");
  for (const bin of manifest.bins) {
    const capacity = numberField(bin, "capacitySpc");
    const opening = numberField(bin, "openingOccupiedSpc");
    if (capacity <= 0 || opening < 0 || opening > capacity) throw new Error(`Invalid occupancy for ${stringField(bin, "id")}`);
  }
  if (manifest.assets.length === 0 || manifest.rewards.length === 0) {
    throw new Error("Seed manifest requires assets and rewards");
  }
}

function createFirestore(mode: SeedMode): Firestore {
  const existing = getApps()[0];
  const app = existing ?? initializeApp(
    process.env.ECOLOOP_STORAGE_BUCKET === undefined
      ? { projectId: process.env.GCLOUD_PROJECT ?? "demo-ecoloop" }
      : {
          projectId: process.env.GCLOUD_PROJECT ?? "demo-ecoloop",
          storageBucket: process.env.ECOLOOP_STORAGE_BUCKET,
        },
  );
  if (mode === "emulator" && process.env.FIRESTORE_EMULATOR_HOST === undefined) {
    throw new Error("Emulator mode requires FIRESTORE_EMULATOR_HOST");
  }
  return getFirestore(app);
}

function resolveSource(sourceRef: string): string {
  const path = isAbsolute(sourceRef) ? sourceRef : resolve(repositoryRoot, sourceRef);
  return path;
}

function stringField(value: JsonObject, field: string): string {
  const result = value[field];
  if (typeof result !== "string" || result.length === 0) throw new Error(`Missing string field ${field}`);
  return result;
}

function numberField(value: JsonObject, field: string): number {
  const result = value[field];
  if (typeof result !== "number" || !Number.isFinite(result)) throw new Error(`Missing numeric field ${field}`);
  return result;
}

function mimeFromPath(path: string): "image/jpeg" | "image/png" | "image/webp" {
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  throw new Error(`Unsupported simulation asset format: ${path}`);
}

if (process.argv[1] !== undefined &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const modeArg = process.argv.find((argument) => argument.startsWith("--mode="))?.split("=")[1] as SeedMode | undefined;
  seed(modeArg ?? "dry-run").then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  }).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
