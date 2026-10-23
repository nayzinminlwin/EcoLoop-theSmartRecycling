import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export const residentCallableOptions = { region: "us-central1" as const };

export interface ResidentRequest {
  readonly requestId: string;
  readonly payload: Record<string, unknown>;
}

export function unpackResidentRequest(
  data: unknown,
  expectedOperation: string,
): ResidentRequest {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Request envelope must be an object");
  }
  const envelope = data as Record<string, unknown>;
  if (envelope.schemaVersion !== "backend.v1") {
    throw new HttpsError("invalid-argument", "Unsupported request schema");
  }
  if (envelope.operation !== expectedOperation) {
    throw new HttpsError("invalid-argument", "Request operation does not match callable");
  }
  const requestId = envelope.requestId;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(requestId)) {
    throw new HttpsError("invalid-argument", "A valid requestId is required");
  }
  const payload = envelope.payload;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpsError("invalid-argument", "Request payload must be an object");
  }
  return { requestId, payload: payload as Record<string, unknown> };
}

export function requireResident(
  request: CallableRequest<unknown>,
  expectedOperation: string,
): ResidentRequest & { readonly uid: string; readonly claims: Record<string, unknown> } {
  if (request.auth === undefined) {
    throw new HttpsError("unauthenticated", "Authentication is required");
  }
  return {
    ...unpackResidentRequest(request.data, expectedOperation),
    uid: request.auth.uid,
    claims: request.auth.token as Record<string, unknown>,
  };
}
