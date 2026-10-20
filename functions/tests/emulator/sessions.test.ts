import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FirestoreSessionsStore } from "../../src/infrastructure/firestore/sessions_store.js";

const binId = "bin-session-test";
const qrPayload = `ecoloop://bin/${binId}`;
const start = "2026-10-19T03:00:00.000Z";

let firestore: Firestore;
let store: FirestoreSessionsStore;
let app: ReturnType<typeof initializeApp>;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `sessions-${Date.now()}`);
  firestore = getFirestore(app);
  store = new FirestoreSessionsStore(firestore);
});

beforeEach(async () => {
  await firestore.recursiveDelete(firestore.doc(`bins/${binId}`));
  await firestore.recursiveDelete(firestore.doc(`binOperations/${binId}`));
  await firestore.recursiveDelete(firestore.doc("binQrMappings/qr-session-test"));
  await firestore.recursiveDelete(firestore.doc("binQrMappings/bin-session-test"));
  await firestore.recursiveDelete(firestore.doc("residents/resident-one"));
  await firestore.recursiveDelete(firestore.doc("residents/resident-two"));
  await firestore.recursiveDelete(firestore.collection("depositSessions"));
  await firestore.doc(`bins/${binId}`).set({
    id: binId, capacitySpc: 100, occupiedSpc: 10, cycleId: "cycle-1", enabled: true, isOnline: true,
  });
  await firestore.doc(`binQrMappings/${binId}`).set({ binId, qrPayload, enabled: true });
});

afterAll(async () => {
  await deleteApp(app);
});

describe("resident session transitions", () => {
  it("atomically reserves one bin and recovers a repeated scan", async () => {
    const first = await store.scanBinQr({ uid: "resident-one", requestId: "scan-one-001" }, qrPayload, start);
    const repeated = await store.scanBinQr({ uid: "resident-one", requestId: "scan-one-002" }, qrPayload, start);

    expect(first.session.id).toBe(repeated.session.id);
    expect(repeated.session.stage).toBe("binFound");
    expect((await firestore.doc(`binOperations/${binId}`).get()).data()).toMatchObject({
      ownerId: "resident-one", sessionId: first.session.id, simulatedAccess: "open",
    });
  });

  it("rejects a competing resident and prevents one resident taking a second bin", async () => {
    await store.scanBinQr({ uid: "resident-one", requestId: "scan-one-003" }, qrPayload, start);
    await expect(store.scanBinQr({ uid: "resident-two", requestId: "scan-two-001" }, qrPayload, start))
      .rejects.toMatchObject({ code: "bin_busy" });

    const otherBin = "bin-session-test-two";
    await firestore.doc(`bins/${otherBin}`).set({
      id: otherBin, capacitySpc: 100, occupiedSpc: 10, cycleId: "cycle-2", enabled: true, isOnline: true,
    });
    await firestore.doc(`binQrMappings/${otherBin}`).set({ binId: otherBin, qrPayload: `ecoloop://bin/${otherBin}`, enabled: true });
    try {
      await expect(store.scanBinQr({ uid: "resident-one", requestId: "scan-one-004" }, `ecoloop://bin/${otherBin}`, start))
        .rejects.toMatchObject({ code: "active_session_exists" });
    } finally {
      await firestore.recursiveDelete(firestore.doc(`bins/${otherBin}`));
      await firestore.recursiveDelete(firestore.doc(`binQrMappings/${otherBin}`));
    }
  });

  it("requires exact versions and preserves the draft asset", async () => {
    const scanned = await store.scanBinQr({ uid: "resident-one", requestId: "scan-one-005" }, qrPayload, start);
    const ready = await store.confirmSession({ uid: "resident-one", requestId: "confirm-one-001" }, scanned.session.id, 0, start);
    const detected = await store.reportFinishPressed({ uid: "resident-one", requestId: "finish-one-001" }, ready.session.id, 1, start);
    await firestore.doc("simulationAssets/asset-session-test").set({
      id: "asset-session-test", version: "v1", enabled: true, contentSha256: "a".repeat(64),
      mimeType: "image/jpeg", width: 10, height: 10,
    });
    const selected = await store.saveImageSelection(
      { uid: "resident-one", requestId: "draft-one-001" }, detected.session.id, "asset-session-test", "v1", 2, start,
    );
    expect(selected.session.draftAssetId).toBe("asset-session-test");
    await expect(store.renewSession({ uid: "resident-one", requestId: "renew-one-001" }, detected.session.id, 1, start))
      .rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("expires an unsubmitted lease and releases the owner reference", async () => {
    const scanned = await store.scanBinQr({ uid: "resident-one", requestId: "scan-one-006" }, qrPayload, start);
    await expect(store.renewSession(
      { uid: "resident-one", requestId: "renew-one-002" }, scanned.session.id, 0, "2026-10-19T03:10:01.000Z",
    )).rejects.toMatchObject({ code: "session_expired" });
    expect((await firestore.doc("residents/resident-one").get()).data()?.activeSessionId).toBeNull();
    expect((await firestore.doc(`binOperations/${binId}`).get()).data()?.phase).toBe("available");
  });

  it("cancels only the matching owned reservation", async () => {
    const scanned = await store.scanBinQr({ uid: "resident-one", requestId: "scan-one-007" }, qrPayload, start);
    await expect(store.cancelSession({ uid: "resident-two", requestId: "cancel-two-001" }, scanned.session.id, 0, start))
      .rejects.toMatchObject({ code: "permission_denied" });
    const cancelled = await store.cancelSession({ uid: "resident-one", requestId: "cancel-one-001" }, scanned.session.id, 0, start);
    expect(cancelled.session.stage).toBe("cancelled");
    expect((await firestore.doc(`binOperations/${binId}`).get()).data()).toMatchObject({ phase: "available", sessionId: null });
  });
});
