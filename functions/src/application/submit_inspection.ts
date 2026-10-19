import type { Instant } from "../domain/types.js";
import type { InspectionStore, InspectionSubmission } from "../infrastructure/firestore/inspection_store.js";

export function submitInspection(
  store: InspectionStore,
  identity: { readonly uid: string; readonly requestId: string },
  sessionId: string,
  assetId: string,
  assetVersion: string,
  expectedVersion: number,
  now: Instant,
  traceId: string,
): Promise<InspectionSubmission> {
  return store.submitInspection(identity, sessionId, assetId, assetVersion, expectedVersion, now, traceId);
}

export function recoverInspectionOperation(
  store: InspectionStore,
  uid: string,
  operationRequestId: string,
): Promise<InspectionSubmission | null> {
  return store.recoverOperation(uid, operationRequestId);
}
