import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { submitInspection } from "../../src/application/submit_inspection.js";
import { cancelSession, scanBinQr, confirmSession, reportFinishPressed, saveImageSelection } from "../../src/application/sessions.js";
import { FirestoreInspectionStore } from "../../src/infrastructure/firestore/inspection_store.js";
import { FirestoreSessionsStore } from "../../src/infrastructure/firestore/sessions_store.js";

const uid = "resident-submission";
const binId = "bin-submission";
const assetId = "asset-submission";
const qrPayload = `ecoloop://bin/${binId}`;
const start = "2026-10-19T03:00:00.000Z";

let firestore: Firestore;
let app: ReturnType<typeof initializeApp>;
let sessions: FirestoreSessionsStore;
let inspections: FirestoreInspectionStore;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `submission-${Date.now()}`);
  firestore = getFirestore(app);
  sessions = new FirestoreSessionsStore(firestore);
  inspections = new FirestoreInspectionStore(firestore);
});

beforeEach(async () => {
  for (const collection of ["residents", "depositSessions", "binOperations", "binQrMappings", "bins", "simulationAssets", "policies", "policyPointers", "deposits", "inferenceJobs", "depositResults", "processingAvailability"]) {
    await firestore.recursiveDelete(firestore.collection(collection));
  }
  await firestore.doc(`bins/${binId}`).set({
    id: binId, capacitySpc: 100, occupiedSpc: 10, cycleId: "cycle-submission",
    enabled: true, isOnline: true,
  });
  await firestore.doc(`binQrMappings/${binId}`).set({ binId, qrPayload, enabled: true });
  await firestore.doc(`simulationAssets/${assetId}`).set({
    id: assetId, version: "v1", enabled: true, contentSha256: "a".repeat(64),
    mimeType: "image/jpeg", width: 100, height: 100,
  });
  await firestore.doc("policyPointers/active").set({ policyId: "policy-v1" });
  await firestore.doc("policies/policy-v1").set({
    id: "policy-v1", version: "policy-v1", acceptedObjectClasses: ["plastic_bottle"],
  });
});

afterAll(async () => {
  await deleteApp(app);
});

describe("immutable inspection submission", () => {
  it("creates one immutable batch, job, processing result and pending dispatch intent", async () => {
    const prepared = await prepareSession(uid, "scan-submission-001", "asset-v1-001");
    const first = await submitInspection(
      inspections, { uid, requestId: "submit-submission-001" }, prepared.sessionId,
      assetId, "v1", prepared.version, start, "trace-submission-001",
    );
    const replay = await submitInspection(
      inspections, { uid, requestId: "submit-submission-001" }, prepared.sessionId,
      assetId, "v1", prepared.version, start, "trace-submission-001",
    );

    expect(first.operationState).toBe("applied");
    expect(replay.operationState).toBe("replayed");
    expect(replay.batchId).toBe(first.batchId);
    expect((await firestore.collection("deposits").get()).size).toBe(1);
    expect((await firestore.collection("inferenceJobs").get()).size).toBe(1);
    expect((await firestore.doc(`inferenceJobs/${first.jobId}`).get()).data()).toMatchObject({
      state: "queued", dispatchState: "pending", policyVersion: "policy-v1",
      cycleId: "cycle-submission", traceId: "trace-submission-001",
    });
    expect((await firestore.doc(`depositSessions/${prepared.sessionId}`).get()).data()).toMatchObject({
      stage: "processing", batchId: first.batchId,
    });
  });

  it("rejects request-key reuse with a different image and a second key for the same session", async () => {
    const prepared = await prepareSession(uid, "scan-submission-002", "asset-v1-002");
    await submitInspection(inspections, { uid, requestId: "submit-submission-002" }, prepared.sessionId, assetId, "v1", prepared.version, start, "trace-submission-002");
    await expect(submitInspection(
      inspections, { uid, requestId: "submit-submission-002" }, prepared.sessionId, "other-asset", "v1", prepared.version, start, "trace-submission-002",
    )).rejects.toMatchObject({ code: "idempotency_conflict" });
    await expect(submitInspection(
      inspections, { uid, requestId: "submit-submission-003" }, prepared.sessionId, assetId, "v1", prepared.version + 1, start, "trace-submission-003",
    )).rejects.toMatchObject({ code: "already_submitted" });
  });

  it("rejects missing, disabled or replaced assets and stale drafts", async () => {
    const missing = await prepareSession("resident-missing", "scan-submission-003", "asset-v1-003");
    await expect(submitInspection(
      inspections, { uid: "resident-missing", requestId: "submit-submission-004" }, missing.sessionId, "missing-asset", "v1", missing.version, start, "trace-submission-004",
    )).rejects.toMatchObject({ code: "asset_version_changed" });
    await cancelSession(sessions, { uid: "resident-missing", requestId: "cancel-missing-001" }, missing.sessionId, missing.version, start);

    const disabled = await prepareSession("resident-disabled", "scan-submission-005", "asset-v1-005");
    await firestore.doc(`simulationAssets/${assetId}`).update({ enabled: false });
    await expect(submitInspection(
      inspections, { uid: "resident-disabled", requestId: "submit-submission-005" }, disabled.sessionId, assetId, "v1", disabled.version, start, "trace-submission-005",
    )).rejects.toMatchObject({ code: "asset_version_changed" });
    await cancelSession(sessions, { uid: "resident-disabled", requestId: "cancel-disabled-001" }, disabled.sessionId, disabled.version, start);
    await firestore.doc(`simulationAssets/${assetId}`).update({ enabled: true });

    const stale = await prepareSession("resident-stale", "scan-submission-006", "asset-v1-006");
    await expect(submitInspection(
      inspections, { uid: "resident-stale", requestId: "submit-submission-006" }, stale.sessionId, assetId, "v1", stale.version - 1, start, "trace-submission-006",
    )).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("recovers the same actor operation and retains the submitted policy after a policy switch", async () => {
    const prepared = await prepareSession(uid, "scan-submission-007", "asset-v1-007");
    const submitted = await submitInspection(
      inspections, { uid, requestId: "submit-submission-007" }, prepared.sessionId, assetId, "v1", prepared.version, start, "trace-submission-007",
    );
    await firestore.doc("policies/policy-v2").set({ id: "policy-v2", version: "policy-v2" });
    await firestore.doc("policyPointers/active").set({ policyId: "policy-v2" });
    const recovered = await inspections.recoverOperation(uid, "submit-submission-007");

    expect(recovered?.operationState).toBe("replayed");
    expect(recovered?.batchId).toBe(submitted.batchId);
    expect((await firestore.doc(`deposits/${submitted.batchId}`).get()).data()?.policyVersion).toBe("policy-v1");
  });
});

async function prepareSession(ownerUid: string, requestId: string, draftRequestId: string): Promise<{ sessionId: string; version: number }> {
  const scanned = await scanBinQr(sessions, { uid: ownerUid, requestId }, qrPayload, start);
  const ready = await confirmSession(sessions, { uid: ownerUid, requestId: `${requestId}-confirm` }, scanned.session.id, 0, start);
  const detected = await reportFinishPressed(sessions, { uid: ownerUid, requestId: `${requestId}-finish` }, ready.session.id, 1, start);
  const selected = await saveImageSelection(
    sessions, { uid: ownerUid, requestId: draftRequestId }, detected.session.id, assetId, "v1", 2, start,
  );
  return { sessionId: selected.session.id, version: selected.session.version };
}
