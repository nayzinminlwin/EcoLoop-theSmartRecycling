import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { imageSize } from "image-size";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(__dirname, "../..");
const manifestPath = resolve(__dirname, "seed-manifest.demo.json");

const projectId = "ecoloop-thesmartrecycling";
const databaseId = "ecoloop-db";
const bucket = "ecoloop-thesmartrecycling.firebasestorage.app";
const documentRoot = `projects/${projectId}/databases/${databaseId}/documents`;

function getAccessToken() {
  const output = process.platform === "win32"
    ? execFileSync("cmd.exe", ["/d", "/s", "/c", "gcloud.cmd auth print-access-token --quiet"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })
    : execFileSync("gcloud", ["auth", "print-access-token", "--quiet"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
  const token = output.trim();
  if (!token) throw new Error("Could not obtain gcloud access token");
  return token;
}

async function inspectStorageAsset(storagePath, token) {
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(storagePath)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Storage inspect error (${res.status}): ${err}`);
  }
  const body = await res.json();
  return {
    path: storagePath,
    size: Number(body.size || "0"),
    sha256: body.metadata?.sha256 || "",
    generation: body.generation || "1",
  };
}

async function uploadStorageAsset(storagePath, bytes, mimeType, sha256, token) {
  const boundary = "==ecoloop-asset-boundary==";
  const metadata = JSON.stringify({
    name: storagePath,
    contentType: mimeType,
    metadata: { sha256 },
  });
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart&ifGenerationMatch=0`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: payload,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Storage upload failed for ${storagePath} (${res.status}): ${err}`);
  }
  const body = await res.json();
  return {
    path: storagePath,
    size: Number(body.size || bytes.byteLength),
    sha256,
    generation: body.generation || "1",
  };
}

async function getExistingFirestoreAssets(token) {
  const url = `https://firestore.googleapis.com/v1/${documentRoot}/simulationAssets`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore list failed (${res.status}): ${err}`);
  }
  const body = await res.json();
  const map = new Map();
  if (body.documents) {
    for (const doc of body.documents) {
      const id = doc.name.split("/").pop();
      map.set(id, doc);
    }
  }
  return map;
}

async function createFirestoreAssetDoc(docPath, fields, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:commit`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `${documentRoot}/${docPath}`,
            fields,
          },
          currentDocument: { exists: false },
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore create failed for ${docPath} (${res.status}): ${err}`);
  }
}

async function main() {
  console.log("=== EcoLoop New Images Seed Runner ===");
  console.log(`Project:  ${projectId}`);
  console.log(`Database: ${databaseId}`);
  console.log(`Bucket:   ${bucket}`);

  const token = getAccessToken();
  console.log("Acquired Google Cloud authentication token.");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  console.log(`Manifest loaded: ${manifest.assets.length} total declared assets.`);

  const existingDocs = await getExistingFirestoreAssets(token);
  console.log(`Found ${existingDocs.size} existing documents in simulationAssets collection.`);

  const summary = {
    preserved: [],
    uploaded: [],
    created: [],
    skippedStorage: [],
  };

  const now = new Date().toISOString();

  for (const asset of manifest.assets) {
    const { id, sourceRef, displayName, sortOrder } = asset;
    const isExistingDoc = existingDocs.has(id);

    if (isExistingDoc) {
      summary.preserved.push(id);
      continue;
    }

    console.log(`\nProcessing NEW asset: ${id} (${displayName}) from ${sourceRef}`);
    const filePath = resolve(repositoryRoot, sourceRef);
    const bytes = await readFile(filePath);
    const dim = imageSize(bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const version = `sha256-${sha256.slice(0, 16)}`;
    const format = dim.type === "jpg" ? "jpg" : dim.type === "png" ? "png" : "webp";
    const mimeType = format === "jpg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
    const storagePath = `simulation-assets/${id}/${version}/source.${format}`;

    console.log(` - Dimensions: ${dim.width}x${dim.height}, Size: ${bytes.byteLength} bytes, SHA: ${sha256.slice(0, 16)}`);
    console.log(` - Storage path: ${storagePath}`);

    // Check if storage asset exists
    let storageInfo = await inspectStorageAsset(storagePath, token);
    if (storageInfo) {
      console.log(` - Storage asset already present in bucket (generation ${storageInfo.generation}), skipping re-upload.`);
      summary.skippedStorage.push(id);
    } else {
      console.log(` - Uploading bytes to bucket ${bucket}...`);
      storageInfo = await uploadStorageAsset(storagePath, bytes, mimeType, sha256, token);
      console.log(` - Uploaded successfully! GCS generation: ${storageInfo.generation}`);
      summary.uploaded.push(id);
    }

    // Create Firestore Document
    console.log(` - Creating Firestore document simulationAssets/${id}...`);
    const fields = {
      id: { stringValue: id },
      displayName: { stringValue: displayName },
      sortOrder: { integerValue: String(sortOrder) },
      enabled: { booleanValue: true },
      version: { stringValue: version },
      storagePath: { stringValue: storagePath },
      contentSha256: { stringValue: sha256 },
      mimeType: { stringValue: mimeType },
      width: { integerValue: String(dim.width) },
      height: { integerValue: String(dim.height) },
      actualBytes: { integerValue: String(bytes.byteLength) },
      storageGeneration: { stringValue: String(storageInfo.generation) },
      schemaVersion: { stringValue: "backend.v1" },
      seedId: { stringValue: manifest.seedId },
      seededAt: { timestampValue: now },
    };

    await createFirestoreAssetDoc(`simulationAssets/${id}`, fields, token);
    console.log(` - Firestore document simulationAssets/${id} created successfully.`);
    summary.created.push(id);
  }

  console.log("\n=== Final Verification ===");
  const updatedDocs = await getExistingFirestoreAssets(token);
  console.log(`Total documents in simulationAssets: ${updatedDocs.size}`);
  console.log(`Preserved existing assets (${summary.preserved.length}): ${summary.preserved.join(", ")}`);
  console.log(`Newly uploaded to Storage (${summary.uploaded.length}): ${summary.uploaded.join(", ")}`);
  console.log(`Newly created in Firestore (${summary.created.length}): ${summary.created.join(", ")}`);

  if (summary.created.length === 8 && updatedDocs.size === 24) {
    console.log("\nSUCCESS: All 8 new images were uploaded to Cloud Storage and registered in Firestore without duplicate or deletion!");
  } else {
    console.log(`\nNote: Finished with ${updatedDocs.size} documents in Firestore.`);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exitCode = 1;
});
