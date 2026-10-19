import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { qrPayloadForBin, seed } from "../../tools/seed.js";

let firestore: Firestore;
let app: ReturnType<typeof initializeApp>;

beforeAll(() => {
  app = initializeApp({
    projectId: "demo-ecoloop",
    storageBucket: "demo-ecoloop.appspot.com",
  }, `seed-${Date.now()}`);
  firestore = getFirestore(app, "ecoloop-db");
});

beforeEach(async () => {
  for (const collection of await firestore.listCollections()) await firestore.recursiveDelete(collection);
});

afterAll(async () => {
  await deleteApp(app);
});

describe("create-only demo reference seed in the named database", () => {
  it("registers every real source, complete catalog and independently inspectable QR mapping", async () => {
    const first = await seed("emulator", undefined, firestore);
    const second = await seed("emulator", undefined, firestore);

    expect(first.verified).toBe(true);
    expect(first.writes.length).toBeGreaterThan(50);
    expect(second.writes).toEqual([]);
    expect(second.preserved).toHaveLength(first.writes.length);
    expect(first.qrFiles).toHaveLength(6);
    for (const qrFile of first.qrFiles) {
      const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(qrFile));
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
    const normal = await firestore.doc("bins/bin-demo-main").get();
    const nearFull = await firestore.doc("bins/bin-sample-near-full").get();
    const full = await firestore.doc("bins/bin-sample-full").get();
    expect(normal.data()).toMatchObject({ occupiedSpc: 0, capacityPercent: 0, syntheticOpeningOccupancy: false });
    expect(nearFull.data()).toMatchObject({ occupiedSpc: 1900, capacityPercent: 95, syntheticOpeningOccupancy: true });
    expect(full.data()).toMatchObject({ occupiedSpc: 2000, capacityPercent: 100 });
    expect((await firestore.doc("bins/bin-sample-offline").get()).data()?.isOnline).toBe(false);
    expect((await firestore.doc("bins/bin-sample-disabled").get()).data()?.enabled).toBe(false);
    expect((await firestore.doc("binQrMappings/qr-demo-main").get()).data()).toMatchObject({
      qrPayload: qrPayloadForBin("qr-demo-main"), binId: "bin-demo-main", enabled: true,
    });
    const asset = (await firestore.doc("simulationAssets/asset-demo-0001").get()).data()!;
    expect(asset).toMatchObject({
      mimeType: "image/jpeg",
      width: 303,
      height: 660,
      actualBytes: 48751,
    });
    const [object] = await getStorage(app).bucket().file(String(asset.storagePath)).getMetadata();
    expect(String(object.generation)).toBe(asset.storageGeneration);
    expect((await firestore.collection("simulationAssets").get()).size).toBe(16);
    expect((await firestore.doc("simulationAssets/asset-demo-0011").get()).data()?.mimeType).toBe("image/png");
    expect((await firestore.collection("rewards").get()).docs.map((doc) => doc.data().pointsCost).sort((a, b) => a - b)).toEqual([10, 25, 50, 75]);
    expect((await firestore.doc("guideMaterials/policy-v1").get()).data()?.items).toHaveLength(5);
    expect((await firestore.doc("processingAvailability/global").get()).data()?.enabled).toBe(false);
  });

  it("preserves occupancy after collection, reservations, operator changes and resident balances on rerun", async () => {
    await seed("emulator", undefined, firestore);
    await firestore.doc("bins/bin-demo-main").update({ cycleId: "collected-cycle", occupiedSpc: 123, enabled: false, displayName: "Operator renamed bin" });
    await firestore.doc("binOperations/bin-demo-main").update({ ownerId: "emulator-owner", sessionId: "emulator-session", phase: "processing" });
    await firestore.doc("residents/emulator-owner/wallet/current").set({ balance: 37, version: 4 });
    await firestore.doc("policyPointers/active").update({ policyId: "operator-policy-v2" });
    await firestore.doc("processingAvailability/global").update({ enabled: true, status: "ready" });
    const before = (await firestore.doc("bins/bin-demo-main").get()).data();
    const rerun = await seed("emulator", undefined, firestore);
    expect(rerun.writes).toEqual([]);
    expect((await firestore.doc("bins/bin-demo-main").get()).data()).toEqual(before);
    expect((await firestore.doc("binOperations/bin-demo-main").get()).data()?.ownerId).toBe("emulator-owner");
    expect((await firestore.doc("residents/emulator-owner/wallet/current").get()).data()).toEqual({ balance: 37, version: 4 });
    expect((await firestore.doc("policyPointers/active").get()).data()?.policyId).toBe("operator-policy-v2");
    expect((await firestore.doc("processingAvailability/global").get()).data()?.enabled).toBe(true);
  });

  it("detects changed same-version policy content before creating any missing records", async () => {
    await seed("emulator", undefined, firestore);
    await firestore.doc("policies/policy-v1").update({ "pointsPerItemByCategory.plastic": 999 });
    await firestore.doc("rewards/reward-cafe").delete();
    await expect(seed("emulator", undefined, firestore)).rejects.toThrow(
      "Immutable seed conflict at policies/policy-v1.pointsPerItemByCategory",
    );
    expect((await firestore.doc("rewards/reward-cafe").get()).exists).toBe(false);
    expect((await firestore.doc("policies/policy-v1").get()).data()?.pointsPerItemByCategory.plastic).toBe(999);
  });

  it("refuses accidental default-database targeting", async () => {
    await expect(seed("emulator", undefined, getFirestore(app))).rejects.toThrow("Seed emulator requires demo-ecoloop/ecoloop-db");
  });
});
