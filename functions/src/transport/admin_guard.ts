import { randomBytes } from "node:crypto";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import type { AdminVerificationResult } from "../infrastructure/firestore/admin_accounts_store.js";

export interface VerifiedAdminContext {
  readonly admin: AdminVerificationResult;
  readonly requestId: string;
  readonly traceId: string;
}

export async function requireAdminCaller(
  request: CallableRequest<unknown>,
  allowAppCheckBypassInEmulator = true
): Promise<VerifiedAdminContext> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required for admin portal.");
  }

  const isEmulator = Boolean(process.env.FUNCTIONS_EMULATOR || process.env.FIREBASE_EMULATOR_HUB);
  if (!isEmulator && !allowAppCheckBypassInEmulator && process.env.ENFORCE_APP_CHECK === "true") {
    if (!request.app) {
      throw new HttpsError("failed-precondition", "App Check attestation is required.");
    }
  }

  const caller = {
    uid: request.auth.uid,
    token: request.auth.token as Record<string, unknown>,
  };

  try {
    const admin = await getComposition().adminAccounts.verifyCaller(caller);
    const traceId = randomBytes(16).toString("hex");
    const requestId = extractRequestId(request.data);

    return { admin, requestId, traceId };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new HttpsError("permission-denied", message);
  }
}

export function extractRequestId(data: unknown): string {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    const reqId = (data as Record<string, unknown>).requestId;
    if (typeof reqId === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(reqId)) {
      return reqId;
    }
  }
  return `req-${randomBytes(12).toString("hex")}`;
}

export function adminSuccessEnvelope(
  operation: string,
  requestId: string,
  traceId: string,
  data: { resourceId: string; version: number; operationState: "applied" | "replayed"; [key: string]: unknown }
) {
  return {
    schemaVersion: "admin.v1",
    operation,
    requestId,
    traceId,
    status: "committed",
    data: {
      ...data,
      committedAt: data.committedAt ?? new Date().toISOString(),
    },
  };
}
