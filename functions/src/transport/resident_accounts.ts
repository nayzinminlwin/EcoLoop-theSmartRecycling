import { randomBytes } from "node:crypto";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { DomainError, isDomainError } from "../domain/errors.js";
import { bootstrapAccount } from "../application/accounts.js";
import { getComposition } from "../composition.js";

export const bootstrapResident = onCall(async (request) => {
  const identity = requireIdentity(request);
  const requestId = requireRequestId(request.data);
  const result = await bootstrapAccount(
    getComposition().accounts,
    identity,
    requestId,
    payload(request.data),
    new Date().toISOString(),
  );
  return envelope("bootstrapResident", requestId, {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}`, `residents/${identity.uid}/wallet/current`],
    version: Number(result.wallet.version ?? 0),
    operationState: result.created ? "applied" : "replayed",
    role: result.role,
  });
});

export const getResidentProfile = onCall(async (request) => {
  const identity = requireIdentity(request);
  const profile = await getComposition().accounts.getProfile(identity.uid);
  if (profile === null) throw new HttpsError("not-found", "Resident profile is not provisioned");
  return envelope("getProfile", requestIdOrGenerated(request.data), {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}`],
    version: 0,
    profile,
  });
});

export const saveResidentPreferences = onCall(async (request) => {
  const identity = requireIdentity(request);
  const data = payload(request.data);
  const preferences = data.preferences;
  if (!isBooleanMap(preferences)) throw new HttpsError("invalid-argument", "preferences must contain boolean values");
  const result = await getComposition().accounts.savePreferences(identity.uid, preferences, new Date().toISOString());
  return envelope("saveNotificationPreferences", requestIdOrGenerated(request.data), {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}/preferences/current`],
    version: 0,
    preferences: result,
  });
});

export const registerResidentDevice = onCall(async (request) => {
  const identity = requireIdentity(request);
  const data = payload(request.data);
  if (typeof data.deviceId !== "string" || typeof data.platform !== "string" || typeof data.token !== "string") {
    throw new HttpsError("invalid-argument", "deviceId, platform and token are required");
  }
  const result = await getComposition().accounts.registerDevice(
    identity.uid, data.deviceId, data.platform, data.token, new Date().toISOString(),
  );
  return envelope("registerDevice", requestIdOrGenerated(request.data), {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}/devices/${data.deviceId}`],
    version: 0,
    device: { ...result, token: "[REDACTED]" },
  });
});

function requireIdentity(request: CallableRequest<unknown>) {
  if (request.auth === undefined) throw new HttpsError("unauthenticated", "Authentication is required");
  return {
    uid: request.auth.uid,
    claims: request.auth.token as Record<string, unknown>,
    displayName: typeof request.auth.token.name === "string" ? request.auth.token.name : null,
    email: typeof request.auth.token.email === "string" ? request.auth.token.email : null,
    avatarUrl: typeof request.auth.token.picture === "string" ? request.auth.token.picture : null,
  };
}

function payload(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Request payload must be an object");
  }
  return data as Record<string, unknown>;
}

function requireRequestId(data: unknown): string {
  const value = payload(data).requestId;
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value)) {
    throw new HttpsError("invalid-argument", "A valid requestId is required");
  }
  return value;
}

function requestIdOrGenerated(data: unknown): string {
  const value = data !== null && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>).requestId
    : undefined;
  return typeof value === "string" && value.length >= 8 ? value : `req-${randomBytes(12).toString("hex")}`;
}

function envelope(operation: string, requestId: string, data: Record<string, unknown>) {
  return { schemaVersion: "backend.v1", operation, requestId, traceId: randomBytes(16).toString("hex"), status: "committed", data };
}

function isBooleanMap(value: unknown): value is Record<string, boolean> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "boolean");
}

export function mapAccountError(error: unknown): never {
  if (isDomainError(error)) throw new HttpsError(error.code === "permission_denied" ? "permission-denied" : "invalid-argument", error.message);
  if (error instanceof HttpsError) throw error;
  throw new HttpsError("internal", "Account operation failed");
}
