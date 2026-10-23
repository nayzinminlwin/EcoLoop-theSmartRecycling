import { randomBytes } from "node:crypto";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { DomainError, isDomainError } from "../domain/errors.js";
import { bootstrapAccount } from "../application/accounts.js";
import { getComposition } from "../composition.js";
import { residentCallableOptions, requireResident } from "./request.js";

export const bootstrapResident = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "bootstrapResident");
  const requestId = identity.requestId;
  const result = await bootstrapAccount(
    getComposition().accounts,
    identity,
    requestId,
    identity.payload,
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

export const getResidentProfile = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "getResidentProfile");
  const profile = await getComposition().accounts.getProfile(identity.uid);
  if (profile === null) throw new HttpsError("not-found", "Resident profile is not provisioned");
  return envelope("getResidentProfile", identity.requestId, {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}`],
    version: 0,
    profile: toProfileDto(profile),
  });
});

export const updateResidentProfile = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "updateResidentProfile");
  const profile = await getComposition().accounts.updateProfile(
    identity.uid,
    identity.payload,
    new Date().toISOString(),
  );
  return envelope("updateResidentProfile", identity.requestId, {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}`],
    version: 0,
    profile: toProfileDto(profile),
  });
});

export const getResidentPreferences = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "getResidentPreferences");
  const preferences = await getComposition().accounts.getPreferences(identity.uid);
  if (preferences === null) throw new HttpsError("not-found", "Resident preferences are not provisioned");
  return envelope("getResidentPreferences", identity.requestId, {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}/preferences/current`],
    version: 0,
    preferences,
  });
});

export const saveResidentPreferences = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "saveResidentPreferences");
  const data = identity.payload;
  const preferences = data.preferences;
  if (!isBooleanMap(preferences)) throw new HttpsError("invalid-argument", "preferences must contain boolean values");
  const result = await getComposition().accounts.savePreferences(identity.uid, preferences, new Date().toISOString());
  return envelope("saveResidentPreferences", identity.requestId, {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}/preferences/current`],
    version: 0,
    preferences: result,
  });
});

export const registerResidentDevice = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "registerResidentDevice");
  const data = identity.payload;
  if (typeof data.deviceId !== "string" || typeof data.platform !== "string" || typeof data.token !== "string") {
    throw new HttpsError("invalid-argument", "deviceId, platform and token are required");
  }
  const result = await getComposition().accounts.registerDevice(
    identity.uid, data.deviceId, data.platform, data.token, new Date().toISOString(),
  );
  return envelope("registerResidentDevice", identity.requestId, {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}/devices/${data.deviceId}`],
    version: 0,
    device: { ...result, token: "[REDACTED]" },
  });
});

export const unregisterResidentDevice = onCall(residentCallableOptions, async (request) => {
  const identity = requireIdentity(request, "unregisterResidentDevice");
  const data = identity.payload;
  if (typeof data.deviceId !== "string" || data.deviceId.trim() === "") {
    throw new HttpsError("invalid-argument", "deviceId is required");
  }
  await getComposition().accounts.unregisterDevice(
    identity.uid,
    data.deviceId,
    new Date().toISOString(),
  );
  return envelope("unregisterResidentDevice", identity.requestId, {
    residentId: identity.uid,
    recordIds: [`residents/${identity.uid}/devices/${data.deviceId}`],
    version: 0,
  });
});

function requireIdentity(request: CallableRequest<unknown>, operation: string) {
  const resident = requireResident(request, operation);
  return {
    ...resident,
    displayName: typeof resident.claims.name === "string" ? resident.claims.name : null,
    email: typeof resident.claims.email === "string" ? resident.claims.email : null,
    avatarUrl: typeof resident.claims.picture === "string" ? resident.claims.picture : null,
  };
}

function envelope(operation: string, requestId: string, data: Record<string, unknown>) {
  return { schemaVersion: "backend.v1", operation, requestId, traceId: randomBytes(16).toString("hex"), status: "committed", data };
}

function isBooleanMap(value: unknown): value is Record<string, boolean> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "boolean");
}

function toProfileDto(profile: Record<string, unknown>): Record<string, unknown> {
  return {
    id: profile.residentId,
    fullName: profile.displayName,
    email: profile.email,
    avatarUrl: profile.avatarUrl ?? null,
    createdAt: profile.createdAt,
  };
}

export function mapAccountError(error: unknown): never {
  if (isDomainError(error)) throw new HttpsError(error.code === "permission_denied" ? "permission-denied" : "invalid-argument", error.message);
  if (error instanceof HttpsError) throw error;
  throw new HttpsError("internal", "Account operation failed");
}
