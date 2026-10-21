import { createHash } from "node:crypto";

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Payload numbers must be finite");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError("Payload contains an unsupported value");
}

export function computeScopedHash(actorUid: string, operation: string, requestId: string): string {
  return createHash("sha256")
    .update(`${actorUid}:${operation}:${requestId}`)
    .digest("hex");
}

export function computePayloadFingerprint(payload: unknown): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

