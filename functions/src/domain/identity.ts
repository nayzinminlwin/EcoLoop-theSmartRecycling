import { createHash } from "node:crypto";
import type { Identifier } from "./types.js";

export interface OperationIdentity {
  readonly actorId: Identifier;
  readonly operation: string;
  readonly requestId: Identifier;
  readonly operationKey: string;
  readonly payloadFingerprint: string;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Identity payload numbers must be finite");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError("Identity payload contains an unsupported value");
}

export function canonicalPayload(value: unknown): string {
  return canonicalize(value);
}

export function payloadFingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalPayload(value)).digest("hex");
}

export function operationKey(actorId: Identifier, operation: string, requestId: Identifier): string {
  return `${actorId}:${operation}:${requestId}`;
}

export function createOperationIdentity(
  actorId: Identifier,
  operation: string,
  requestId: Identifier,
  payload: unknown,
): OperationIdentity {
  return {
    actorId,
    operation,
    requestId,
    operationKey: operationKey(actorId, operation, requestId),
    payloadFingerprint: payloadFingerprint(payload),
  };
}
