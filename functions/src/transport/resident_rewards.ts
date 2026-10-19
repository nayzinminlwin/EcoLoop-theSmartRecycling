import { randomBytes } from "node:crypto";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { redeemReward as redeemRewardApplication, useDemoVoucher } from "../application/rewards.js";
import { isDomainError } from "../domain/errors.js";

export const redeemResidentReward = onCall(async (request) => {
  const identity = requireIdentity(request);
  try {
    const result = await redeemRewardApplication(
      getComposition().rewards, { uid: identity.uid }, identity.requestId,
      operationPayload(request.data), new Date().toISOString(),
    );
    return envelope("redeemResidentReward", identity.requestId, result);
  } catch (error) {
    throw mapRewardError(error);
  }
});

export const redeemReward = onCall(async (request) => {
  const identity = requireIdentity(request);
  try {
    const result = await redeemRewardApplication(
      getComposition().rewards, { uid: identity.uid }, identity.requestId,
      operationPayload(request.data), new Date().toISOString(),
    );
    return envelope("redeemReward", identity.requestId, result);
  } catch (error) {
    throw mapRewardError(error);
  }
});

export const useResidentDemoVoucher = onCall(async (request) => {
  const identity = requireIdentity(request);
  try {
    const result = await useDemoVoucher(
      getComposition().rewards, { uid: identity.uid }, identity.requestId,
      operationPayload(request.data), new Date().toISOString(),
    );
    return envelope("useResidentDemoVoucher", identity.requestId, result);
  } catch (error) {
    throw mapRewardError(error);
  }
});

function requireIdentity(request: CallableRequest<unknown>): { uid: string; requestId: string } {
  if (request.auth === undefined) throw new HttpsError("unauthenticated", "Authentication is required");
  const data = payload(request.data);
  if (typeof data.requestId !== "string" || data.requestId.trim() === "") {
    throw new HttpsError("invalid-argument", "requestId is required");
  }
  return { uid: request.auth.uid, requestId: data.requestId.trim() };
}

function payload(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "Request payload must be an object");
  }
  return value as Record<string, unknown>;
}

function operationPayload(value: unknown): Record<string, unknown> {
  const data = payload(value);
  return data.payload === undefined ? data : payload(data.payload);
}

function envelope(operation: string, requestId: string, data: unknown) {
  return {
    schemaVersion: "backend.v1", operation, requestId, traceId: randomBytes(16).toString("hex"),
    status: "committed", data,
  };
}

function mapRewardError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (isDomainError(error)) {
    const code = error.code === "permission_denied" ? "permission-denied"
      : error.code === "invalid_input" ? "invalid-argument"
      : error.code === "idempotency_conflict" ? "already-exists"
      : error.code === "insufficient_points" || error.code === "redemption_limit_reached" ||
        error.code === "offer_changed" || error.code === "voucher_expired" || error.code === "voucher_used"
        ? "failed-precondition" : "internal";
    return new HttpsError(code, error.message, error.toSafeResponse());
  }
  return new HttpsError("internal", "Reward operation failed");
}
