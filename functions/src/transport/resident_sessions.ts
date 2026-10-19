import { randomBytes } from "node:crypto";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import {
  cancelSession as cancelSessionApplication,
  confirmSession as confirmSessionApplication,
  recoverOperation as recoverOperationApplication,
  renewSession as renewSessionApplication,
  reportFinishPressed as reportFinishPressedApplication,
  saveImageSelection as saveImageSelectionApplication,
  scanBinQr as scanBinQrApplication,
} from "../application/sessions.js";
import { DomainError, isDomainError } from "../domain/errors.js";
import { getComposition } from "../composition.js";
import { recoverSubmittedInspection } from "./resident_inspections.js";

export const scanBinQr = onCall((request) => callSession(request, "scanBinQr", (identity, data, now) =>
  scanBinQrApplication(getComposition().sessions, identity, stringField(data, "qrPayload"), now)));

export const confirmSession = onCall((request) => callSession(request, "confirmSession", (identity, data, now) =>
  confirmSessionApplication(getComposition().sessions, identity, stringField(data, "sessionId"), integerField(data, "expectedVersion"), now)));

export const reportFinishPressed = onCall((request) => callSession(request, "reportFinishPressed", (identity, data, now) =>
  reportFinishPressedApplication(getComposition().sessions, identity, stringField(data, "sessionId"), integerField(data, "expectedVersion"), now)));

export const saveImageSelection = onCall((request) => callSession(request, "saveImageSelection", (identity, data, now) =>
  saveImageSelectionApplication(
    getComposition().sessions, identity, stringField(data, "sessionId"), stringField(data, "assetId"),
    stringField(data, "assetVersion"), integerField(data, "expectedVersion"), now,
  )));

export const renewSession = onCall((request) => callSession(request, "renewSession", (identity, data, now) =>
  renewSessionApplication(getComposition().sessions, identity, stringField(data, "sessionId"), integerField(data, "expectedVersion"), now)));

export const cancelSession = onCall((request) => callSession(request, "cancelSession", (identity, data, now) =>
  cancelSessionApplication(getComposition().sessions, identity, stringField(data, "sessionId"), integerField(data, "expectedVersion"), now)));

export const recoverOperation = onCall(async (request) => {
  const identity = requireIdentity(request);
  const data = payload(request.data);
  const requestId = stringField(data, "requestId");
  const operationRequestId = stringField(data, "operationId");
  const sessionResult = await recoverOperationApplication(getComposition().sessions, { uid: identity.uid, requestId }, operationRequestId);
  if (sessionResult !== null) return envelope("recoverOperation", requestId, sessionResult);
  const inspectionResult = await recoverSubmittedInspection(identity.uid, operationRequestId);
  if (inspectionResult === null) throw new HttpsError("not-found", "Operation was not found for this resident");
  return {
    schemaVersion: "backend.v1",
    operation: "recoverOperation",
    requestId,
    traceId: inspectionResult.traceId,
    status: "committed",
    data: {
      residentId: inspectionResult.ownerId,
      recordIds: [`deposits/${inspectionResult.batchId}`, `inferenceJobs/${inspectionResult.jobId}`, `depositResults/${inspectionResult.resultId}`],
      version: 1,
      operationState: "replayed",
      stage: "processing",
      batchId: inspectionResult.batchId,
      jobId: inspectionResult.jobId,
      resultId: inspectionResult.resultId,
    },
  };
});

async function callSession(
  request: CallableRequest<unknown>,
  operation: string,
  callback: (identity: { uid: string; requestId: string }, data: Record<string, unknown>, now: string) => ReturnType<typeof scanBinQrApplication>,
) {
  const identity = requireIdentity(request);
  const data = payload(request.data);
  try {
    const result = await callback(identity, data, new Date().toISOString());
    return envelope(operation, identity.requestId, result);
  } catch (error) {
    throw mapSessionError(error);
  }
}

function requireIdentity(request: CallableRequest<unknown>): { uid: string; requestId: string } {
  if (request.auth === undefined) throw new HttpsError("unauthenticated", "Authentication is required");
  const data = payload(request.data);
  const requestId = stringField(data, "requestId");
  return { uid: request.auth.uid, requestId };
}

function payload(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "Request payload must be an object");
  }
  return value as Record<string, unknown>;
}

function stringField(data: Record<string, unknown>, name: string): string {
  const value = data[name];
  if (typeof value !== "string" || value.trim() === "") throw new HttpsError("invalid-argument", `${name} is required`);
  return value;
}

function integerField(data: Record<string, unknown>, name: string): number {
  const value = data[name];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new HttpsError("invalid-argument", `${name} must be a non-negative integer`);
  return value;
}

function envelope(operation: string, requestId: string, result: Awaited<ReturnType<typeof scanBinQrApplication>>) {
  return {
    schemaVersion: "backend.v1",
    operation,
    requestId,
    traceId: randomBytes(16).toString("hex"),
    status: "committed",
    data: {
      residentId: result.session.ownerId,
      recordIds: [`depositSessions/${result.session.id}`],
      version: result.session.version,
      operationState: result.operationState,
      stage: result.session.stage,
      session: result.session,
      ...(result.bin === null ? {} : { bin: result.bin }),
    },
  };
}

function mapSessionError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (isDomainError(error)) {
    const code = error.code === "permission_denied" ? "permission-denied"
      : error.code === "invalid_qr" || error.code === "invalid_input" ? "invalid-argument"
      : error.code === "bin_full" || error.code === "bin_busy" || error.code === "bin_unavailable" ? "failed-precondition"
      : error.code === "session_expired" ? "deadline-exceeded"
      : error.code === "active_session_exists" || error.code === "asset_version_changed" ? "aborted"
      : error.code === "already_submitted" || error.code === "idempotency_conflict" ? "already-exists"
      : "internal";
    return new HttpsError(code, error.message, error.toSafeResponse());
  }
  return new HttpsError("internal", "Session operation failed");
}
