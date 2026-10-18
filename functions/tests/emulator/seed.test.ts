import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { qrPayloadForBin, seed } from "../../tools/seed.js";

let firestore: Firestore;
let app: ReturnType<typeof initializeApp>;

beforeAll(() => {
  app = initializeApp({
    projectId: "demo-ecoloop",
    storageBucket: "demo-ecoloop.appspot.com",
  }, `seed-${Date.now()}`);
  firestore = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

describe("repeatable P02-F seed", () => {
  it("seeds the required bin situations and real source metadata", async () => {
    const first = await seed("emulator", undefined, firestore);
    const second = await seed("emulator", undefined, firestore);

    expect(first.writes).toHaveLength(second.writes.length);
    expect(first.qrFiles).toHaveLength(3);
    for (const qrFile of first.qrFiles) {
      const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(qrFile));
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
    const normal = await firestore.doc("bins/bin-demo-normal").get();
    const nearFull = await firestore.doc("bins/bin-demo-near-full").get();
    const full = await firestore.doc("bins/bin-demo-full").get();
    expect(normal.data()).toMatchObject({ occupiedSpc: 200, capacityPercent: 10 });
    expect(nearFull.data()).toMatchObject({ occupiedSpc: 1700, capacityPercent: 85 });
    expect(full.data()).toMatchObject({ occupiedSpc: 2000, capacityPercent: 100 });
    expect((await firestore.doc("binQrMappings/bin-demo-normal").get()).data()).toMatchObject({
      qrPayload: qrPayloadForBin("bin-demo-normal"),
    });
    expect((await firestore.doc("simulationAssets/asset-demo-0001").get()).data()).toMatchObject({
      mimeType: "image/jpeg",
      width: 303,
      height: 660,
      actualBytes: 48751,
    });
  });

  it("rejects an immutable policy conflict instead of overwriting it", async () => {
    await firestore.doc("policies/policy-v1").set({ version: "operator-version" }, { merge: true });
    await expect(seed("emulator", undefined, firestore)).rejects.toThrow(
      "Immutable seed conflict at policies/policy-v1.version",
    );
  });
});
