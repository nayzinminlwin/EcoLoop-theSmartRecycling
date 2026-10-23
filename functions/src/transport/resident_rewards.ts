import { randomBytes } from "node:crypto";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { redeemReward as redeemRewardApplication, useDemoVoucher } from "../application/rewards.js";
import { isDomainError } from "../domain/errors.js";
import { residentCallableOptions, requireResident } from "./request.js";

export const redeemResidentReward = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "redeemResidentReward");
  try {
    const result = await redeemRewardApplication(
      getComposition().rewards, { uid: identity.uid }, identity.requestId,
      identity.payload, new Date().toISOString(),
    );
    return envelope("redeemResidentReward", identity.requestId, result);
  } catch (error) {
    throw mapRewardError(error);
  }
});

export const redeemReward = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "redeemReward");
  try {
    const result = await redeemRewardApplication(
      getComposition().rewards, { uid: identity.uid }, identity.requestId,
      identity.payload, new Date().toISOString(),
    );
    return envelope("redeemReward", identity.requestId, result);
  } catch (error) {
    throw mapRewardError(error);
  }
});

export const useResidentDemoVoucher = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "useResidentDemoVoucher");
  try {
    const result = await useDemoVoucher(
      getComposition().rewards, { uid: identity.uid }, identity.requestId,
      identity.payload, new Date().toISOString(),
    );
    return envelope("useResidentDemoVoucher", identity.requestId, result);
  } catch (error) {
    throw mapRewardError(error);
  }
});

function requireIdentity(request: CallableRequest<unknown>, operation: string): { uid: string; requestId: string; payload: Record<string, unknown> } {
  const identity = requireResident(request, operation);
  return { uid: identity.uid, requestId: identity.requestId, payload: identity.payload };
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
