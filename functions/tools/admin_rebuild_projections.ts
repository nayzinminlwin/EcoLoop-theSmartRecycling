// =============================================================================
// admin_rebuild_projections.ts — Rebuild & backfill materialized query projections
// Phase AB-03 — Scans canonical records and synchronizes admin view collections
// =============================================================================

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FirestoreAdminProjectionsStore } from "../src/infrastructure/firestore/admin_projections_store.js";
import { FirestoreAdminReadVersionsStore } from "../src/infrastructure/firestore/admin_read_versions_store.js";

type Environment = "emulator" | "live";
type Mode = "preview" | "apply";
type Topic = "bins" | "rewards" | "all";

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  })
);

const environment = (args.get("environment") ?? "emulator") as Environment;
const projectId = args.get("project") ?? (environment === "emulator" ? "demo-ecoloop" : "ecoloop-thesmartrecycling");
const databaseId = args.get("database") ?? "ecoloop-db";
const topic = (args.get("topic") ?? "all") as Topic;
const mode = (args.get("mode") ?? "preview") as Mode;

if (environment !== "emulator" && environment !== "live") {
  throw new Error("--environment must be emulator or live");
}

if (environment === "emulator") {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
}

process.env.GCLOUD_PROJECT = projectId;
if (getApps().length === 0) {
  initializeApp({ projectId });
}

const firestore = getFirestore(databaseId);
const projectionsStore = new FirestoreAdminProjectionsStore(firestore);
const readVersionsStore = new FirestoreAdminReadVersionsStore(firestore);

async function run() {
  console.log(`[rebuild_projections] Environment: ${environment}, Project: ${projectId}, Database: ${databaseId}, Topic: ${topic}, Mode: ${mode}`);

  if (topic === "bins" || topic === "all") {
    console.log(`\n--- Rebuilding adminBinViews ---`);
    const binsSnap = await firestore.collection("bins").get();
    console.log(`Found ${binsSnap.docs.length} canonical bins.`);

    for (const doc of binsSnap.docs) {
      const binData = doc.data();
      const opsSnap = await firestore.doc(`binOperations/${doc.id}`).get();
      const opsData = opsSnap.exists ? opsSnap.data() : null;

      const projected = projectionsStore.projectBin(
        { id: doc.id, ...binData },
        opsData
      );

      console.log(`  [Bin ${doc.id}] ${projected.locationName} | ${projected.capacitySpc} spc | fill: ${projected.fillPercent}% (${projected.collectionState}) | ${projected.searchTokens?.length ?? 0} tokens`);

      if (mode === "apply") {
        await projectionsStore.writeBinView(projected);
      }
    }

    if (mode === "apply") {
      const v = await readVersionsStore.bumpVersion("bins");
      console.log(`Bumped adminReadVersions/bins to version ${v.version}`);
    }
  }

  if (topic === "rewards" || topic === "all") {
    console.log(`\n--- Rebuilding adminRewardViews & adminRewardCategoryViews ---`);
    const categoriesSnap = await firestore.collection("rewardCategories").get();
    console.log(`Found ${categoriesSnap.docs.length} reward categories.`);

    const catNameMap = new Map<string, string>();
    for (const catDoc of categoriesSnap.docs) {
      const catData = catDoc.data();
      const catName = String(catData.name ?? catData.categoryName ?? catDoc.id);
      catNameMap.set(catDoc.id, catName);

      if (mode === "apply") {
        await projectionsStore.writeRewardCategoryView({
          categoryId: catDoc.id,
          categoryName: catName,
          description: catData.description ? String(catData.description) : null,
          sortOrder: Number(catData.sortOrder ?? 0),
        });
      }
    }

    const rewardsSnap = await firestore.collection("rewards").get();
    console.log(`Found ${rewardsSnap.docs.length} canonical rewards.`);

    for (const rDoc of rewardsSnap.docs) {
      const rData = rDoc.data();
      const catName = catNameMap.get(String(rData.categoryId ?? "")) ?? "General";
      const projectedReward = projectionsStore.projectReward(
        { id: rDoc.id, ...rData },
        catName
      );

      console.log(`  [Reward ${rDoc.id}] ${projectedReward.title} | ${projectedReward.pointsCost} pts | category: ${projectedReward.categoryName} | active: ${projectedReward.isActive}`);

      if (mode === "apply") {
        await projectionsStore.writeRewardView(projectedReward);
      }
    }

    if (mode === "apply") {
      const v = await readVersionsStore.bumpVersion("rewards");
      console.log(`Bumped adminReadVersions/rewards to version ${v.version}`);
    }
  }

  console.log(`\nProjection rebuild complete (${mode} mode).`);
}

await run();
