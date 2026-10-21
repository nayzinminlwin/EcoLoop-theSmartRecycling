import { createHash } from "node:crypto";

export function computeScopedHash(actorUid: string, operation: string, requestId: string): string {
  return createHash("sha256")
    .update(`${actorUid}:${operation}:${requestId}`)
    .digest("hex");
}

export function computePayloadFingerprint(payload: unknown): string {
  const json = JSON.stringify(payload, Object.keys((payload ?? {}) as object).sort());
  return createHash("sha256").update(json).digest("hex");
}
