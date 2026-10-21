import { randomBytes } from "node:crypto";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { recoverInspectionOperation, submitInspection as submitInspectionApplication } from "../application/submit_inspection.js";
import { DomainError, isDomainError } from "../domain/errors.js";
import { getComposition } from "../composition.js";
import type { Dispatcher } from "../infrastructure/cloud_tasks.js";
import type { InspectionSubmission } from "../infrastructure/firestore/inspection_store.js";
import { StructuredLogger } from "../infrastructure/logger.js";
import { residentCallableOptions, requireResident } from "./request.js";

export const submitInspection = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "submitInspection");
  const data = identity.payload;
  const traceId = randomBytes(16).toString("hex");
  try {
    const composition = getComposition();
    const result = await submitInspectionApplication(
      composition.inspections,
      identity,
      stringField(data, "sessionId"),
      stringField(data, "assetId"),
      stringField(data, "assetVersion"),
      integerField(data, "expectedVersion"),
      new Date().toISOString(),
      traceId,
    );
    const dispatchState = await dispatchCommittedSubmission(
      composition.dispatcher,
      composition.logger,
      result,
    );
    return envelope("submitInspection", identity.requestId, result, dispatchState);
  } catch (error) {
    throw mapInspectionError(error);
  }
});

export async function recoverSubmittedInspection(
  uid: string,
  operationRequestId: string,
) {
  return recoverInspectionOperation(getComposition().inspections, uid, operationRequestId);
}

function requireIdentity(request: CallableRequest<unknown>, operation: string): { uid: string; requestId: string; payload: Record<string, unknown> } {
  const identity = requireResident(request, operation);
  return { uid: identity.uid, requestId: identity.requestId, payload: identity.payload };
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
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new HttpsError("invalid-argument", `${name} must be a non-negative integer`);
  }
  return value;
}

export async function dispatchCommittedSubmission(
  dispatcher: Dispatcher,
  logger: StructuredLogger,
  result: InspectionSubmission,
  now = new Date().toISOString(),
): Promise<"pending" | "dispatched"> {
  try {
    await dispatcher.dispatchJob(result.jobId, now);
    return "dispatched";
  } catch (error) {
    logger.error("inspection.dispatch_enqueue_failed", error, {
      jobId: result.jobId,
      batchId: result.batchId,
      traceId: result.traceId,
      dispatchState: result.dispatchState,
    });
    return "pending";
  }
}

function envelope(
  operation: string,
  requestId: string,
  result: Awaited<ReturnType<typeof submitInspectionApplication>>,
  dispatchState: "pending" | "dispatched" = result.dispatchState,
) {
  return {
    schemaVersion: "backend.v1",
    operation,
    requestId,
    traceId: result.traceId,
    status: "committed",
    data: {
      residentId: result.ownerId,
      recordIds: [`deposits/${result.batchId}`, `inferenceJobs/${result.jobId}`, `depositResults/${result.resultId}`],
      version: 1,
      operationState: result.operationState,
      stage: "processing",
      batchId: result.batchId,
      jobId: result.jobId,
      resultId: result.resultId,
      deadlineAt: result.deadlineAt,
      dispatchState,
    },
  };
}

function mapInspectionError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (isDomainError(error)) {
    const code = error.code === "permission_denied" ? "permission-denied"
      : error.code === "asset_version_changed" || error.code === "invalid_input" ? "failed-precondition"
      : error.code === "session_expired" ? "deadline-exceeded"
      : error.code === "already_submitted" || error.code === "idempotency_conflict" ? "already-exists"
      : error.code === "invalid_transition" ? "aborted"
      : error.code === "processing_unavailable" ? "unavailable"
      : "internal";
    return new HttpsError(code, error.message, error.toSafeResponse());
  }
  return new HttpsError("internal", "Inspection submission failed");
}
