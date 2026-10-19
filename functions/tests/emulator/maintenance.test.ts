import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FirestoreMaintenanceStore } from "../../src/infrastructure/firestore/maintenance_store.js";

const now = "2026-10-19T03:00:00.000Z";
let firestore: Firestore;
let app: ReturnType<typeof initializeApp>;
let maintenance: FirestoreMaintenanceStore;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `maintenance-${Date.now()}`);
  firestore = getFirestore(app);
  maintenance = new FirestoreMaintenanceStore(firestore);
});

beforeEach(async () => {
  for (const collection of ["vouchers", "rewardReminders", "notificationEvents", "residents", "diagnosticArtifacts"]) {
    await firestore.recursiveDelete(firestore.collection(collection));
  }
});

afterAll(async () => {
  await deleteApp(app);
});

describe("daily maintenance", () => {
  it("creates one preference-enabled reminder and expires available vouchers without refunds", async () => {
    await firestore.doc("residents/resident-maintenance/preferences/current").set({ rewardReminders: true });
    await firestore.doc("vouchers/voucher-reminder").set({
      residentId: "resident-maintenance", status: "available",
      expiresAt: "2026-10-22T03:00:00.000Z",
    });
    await firestore.doc("vouchers/voucher-expired").set({
      residentId: "resident-maintenance", status: "available",
      expiresAt: "2026-10-18T03:00:00.000Z",
    });

    const first = await maintenance.runDaily(now);
    const second = await maintenance.runDaily(now);

    expect(first).toMatchObject({ remindersCreated: 1, vouchersExpired: 1 });
    expect(second).toMatchObject({ remindersCreated: 0, vouchersExpired: 0 });
    expect((await firestore.doc("vouchers/voucher-expired").get()).data()).toMatchObject({ status: "expired" });
    expect((await firestore.doc("notificationEvents/voucher-expiry-voucher-reminder").get()).data()).toMatchObject({
      kind: "voucher_reminder", targetType: "voucher", targetId: "voucher-reminder",
    });
  });

  it("does not purge an eligible artifact without a configured storage bucket", async () => {
    await firestore.doc("diagnosticArtifacts/eligible").set({
      state: "eligible", purgeAfterAt: "2026-10-18T03:00:00.000Z",
      storagePath: "inspection-evidence/batch/run/crops/a.json", generation: "1",
    });
    const result = await maintenance.runDaily(now);
    expect(result.artifactsPurged).toBe(0);
    expect((await firestore.doc("diagnosticArtifacts/eligible").get()).data()?.state).toBe("purge_pending");
  });
});
