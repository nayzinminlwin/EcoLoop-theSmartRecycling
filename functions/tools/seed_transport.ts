import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { App } from "firebase-admin/app";

export type SeedRecord = Record<string, unknown>;
export interface SeedWrite { readonly path: string; readonly data: SeedRecord }
export interface StoredAsset { readonly generation: string; readonly sha256: string; readonly size: number }
export interface SeedTransport {
  read(paths: readonly string[]): Promise<Map<string, SeedRecord>>;
  create(writes: readonly SeedWrite[]): Promise<void>;
  inspectAsset(path: string): Promise<StoredAsset | null>;
  uploadAsset(path: string, content: Buffer, mimeType: string): Promise<StoredAsset>;
}

export class EmulatorSeedTransport implements SeedTransport {
  constructor(private readonly firestore: Firestore, private readonly app: App) {
    if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      throw new Error("Both Firestore and Storage emulators are required");
    }
  }

  async read(paths: readonly string[]): Promise<Map<string, SeedRecord>> {
    const snapshots = await this.firestore.getAll(...paths.map((path) => this.firestore.doc(path)));
    return new Map(snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.ref.path, snapshot.data()!]));
  }

  async create(writes: readonly SeedWrite[]): Promise<void> {
    if (writes.length === 0) return;
    const batch = this.firestore.batch();
    for (const write of writes) batch.create(this.firestore.doc(write.path), write.data);
    await batch.commit();
  }

  async inspectAsset(path: string): Promise<StoredAsset | null> {
    const file = getStorage(this.app).bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    const [content] = await file.download();
    return { generation: String(metadata.generation), sha256: sha256(content), size: content.byteLength };
  }

  async uploadAsset(path: string, content: Buffer, mimeType: string): Promise<StoredAsset> {
    const file = getStorage(this.app).bucket().file(path);
    await file.save(content, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: mimeType, metadata: { contentSha256: sha256(content) } },
    });
    const [metadata] = await file.getMetadata();
    return { generation: String(metadata.generation), sha256: sha256(content), size: content.byteLength };
  }
}

/** Local operator transport: uses the already authenticated gcloud session.
 * Tokens stay in memory; no ADC files, service-account keys or token logging.
 */
export class GcloudSeedTransport implements SeedTransport {
  private token: string | undefined;
  private tokenExpiresAt = 0;
  private readonly documentRoot: string;

  constructor(
    readonly projectId: string,
    readonly databaseId: string,
    readonly bucket: string,
  ) {
    if (projectId !== "ecoloop-thesmartrecycling" || databaseId !== "ecoloop-db" ||
        bucket !== "ecoloop-thesmartrecycling.firebasestorage.app") {
      throw new Error("Live seed target must match the verified existing project/database/bucket");
    }
    if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST) {
      throw new Error("Live mode refuses emulator environment variables");
    }
    this.documentRoot = `projects/${projectId}/databases/${databaseId}/documents`;
  }

  async read(paths: readonly string[]): Promise<Map<string, SeedRecord>> {
    const response = await this.request(`https://firestore.googleapis.com/v1/${this.documentRoot}:batchGet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: paths.map((path) => `${this.documentRoot}/${path}`) }),
    });
    const rows = await response.json() as Array<{ found?: { name: string; fields: Record<string, FirestoreValue> } }>;
    const records = new Map<string, SeedRecord>();
    for (const row of rows) {
      if (row.found) {
        records.set(row.found.name.slice(this.documentRoot.length + 1), decodeFields(row.found.fields));
      }
    }
    return records;
  }

  async create(writes: readonly SeedWrite[]): Promise<void> {
    if (writes.length === 0) return;
    await this.request(`https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents:commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: writes.map((write) => ({
          update: { name: `${this.documentRoot}/${write.path}`, fields: encodeFields(write.data) },
          currentDocument: { exists: false },
        })),
      }),
    });
  }

  async inspectAsset(path: string): Promise<StoredAsset | null> {
    const url = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(path)}`;
    const response = await this.request(url, {}, true);
    if (response.status === 404) return null;
    const metadata = await response.json() as { generation: string; size: string };
    const contentResponse = await this.request(`${url}?alt=media&generation=${metadata.generation}`);
    const content = Buffer.from(await contentResponse.arrayBuffer());
    return { generation: metadata.generation, sha256: sha256(content), size: Number(metadata.size) };
  }

  async uploadAsset(path: string, content: Buffer, mimeType: string): Promise<StoredAsset> {
    const boundary = `ecoloop-seed-${sha256(content).slice(0, 24)}`;
    const metadata = { name: path, contentType: mimeType, metadata: { contentSha256: sha256(content), source: "ecoloop-demo-reference-seed-v1" } };
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const response = await this.request(
      `https://storage.googleapis.com/upload/storage/v1/b/${this.bucket}/o?uploadType=multipart&ifGenerationMatch=0`,
      { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: new Uint8Array(body) },
    );
    const result = await response.json() as { generation: string };
    return { generation: result.generation, sha256: sha256(content), size: content.byteLength };
  }

  private async request(url: string, options: RequestInit = {}, allowNotFound = false): Promise<Response> {
    if (!this.token || Date.now() >= this.tokenExpiresAt) {
      this.token = process.platform === "win32"
        ? execFileSync("cmd.exe", ["/d", "/s", "/c", "gcloud.cmd auth print-access-token --quiet"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
        : execFileSync("gcloud", ["auth", "print-access-token", "--quiet"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      if (!this.token) throw new Error("gcloud authentication is required");
      this.tokenExpiresAt = Date.now() + 10 * 60 * 1000;
    }
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(60_000),
      headers: { ...options.headers, Authorization: `Bearer ${this.token}` },
    });
    if (response.ok || (allowNotFound && response.status === 404)) return response;
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`Cloud seed request failed (${response.status}): ${body.error?.message ?? response.statusText}`);
  }
}

type FirestoreValue = {
  nullValue?: null; booleanValue?: boolean; integerValue?: string; doubleValue?: number;
  stringValue?: string; timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] }; mapValue?: { fields?: Record<string, FirestoreValue> };
};

function encodeFields(value: SeedRecord): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encode(entry)]));
}

function encode(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (value instanceof Timestamp) return { timestampValue: value.toDate().toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object" && value !== null) return { mapValue: { fields: encodeFields(value as SeedRecord) } };
  throw new Error("Unsupported seed field value");
}

function decodeFields(value: Record<string, FirestoreValue>): SeedRecord {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decode(entry)]));
}

function decode(value: FirestoreValue): unknown {
  if ("nullValue" in value) return null;
  if (value.timestampValue !== undefined) return Timestamp.fromDate(new Date(value.timestampValue));
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.arrayValue !== undefined) return (value.arrayValue.values ?? []).map(decode);
  if (value.mapValue !== undefined) return decodeFields(value.mapValue.fields ?? {});
  throw new Error("Unsupported existing Firestore field type");
}

export function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}
