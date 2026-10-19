import { HttpsError } from "firebase-functions/v2/https";
import { onRequest, type Request } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { DomainError, isDomainError } from "../domain/errors.js";
import { getComposition } from "../composition.js";
import type { WorkerIdentity } from "../infrastructure/firestore/jobs_store.js";

export const workerGateway = onRequest(async (request, response) => {
  try {
    const identity = await verifyWorkerIdentity(request);
    const data = request.body as Record<string, unknown>;
    const operation = typeof data.operation === "string" ? data.operation : "";
    const result = await routeOperation(operation, data, identity);
    response.status(200).json({ schemaVersion: "backend.v1", status: "committed", operation, data: result });
  } catch (error) {
    const mapped = mapJobError(error);
    response.status(httpStatus(mapped.code)).json({
      schemaVersion: "backend.v1",
      status: "error",
      error: { code: mapped.code, message: mapped.message, retryable: isRetryable(mapped.code) },
    });
  }
});

async function routeOperation(operation: string, data: Record<string, unknown>, identity: WorkerIdentity) {
  const jobs = getComposition().jobs;
  const now = new Date().toISOString();
  switch (operation) {
    case "claim":
      return jobs.claim(requiredString(data, "jobId"), identity, now);
    case "checkpoint":
      return jobs.checkpoint(
        requiredString(data, "jobId"), requiredString(data, "attemptId"), identity,
        requiredString(data, "stage"), requiredString(data, "outputReference"), now,
      );
    case "renew":
      return jobs.renew(requiredString(data, "jobId"), requiredString(data, "attemptId"), identity, now);
    case "fail":
      return jobs.fail(requiredString(data, "jobId"), requiredString(data, "attemptId"), identity, requiredString(data, "reason"), now);
    case "readCurrentResult":
      return jobs.readCurrentResult(requiredString(data, "jobId"), identity);
    default:
      throw new HttpsError("invalid-argument", "Unsupported worker operation");
  }
}

async function verifyWorkerIdentity(request: Request): Promise<WorkerIdentity> {
  const header = request.header("authorization");
  if (header === undefined || !header.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Worker authentication is required");
  }
  const token = header.slice("Bearer ".length).trim();
  if (token === "") throw new HttpsError("unauthenticated", "Worker authentication is required");
  const decoded = await getAuth().verifyIdToken(token);
  if (decoded.workerService !== true) throw new HttpsError("permission-denied", "Worker service identity is required");
  return { subject: decoded.uid, issuer: decoded.iss };
}

function requiredString(data: Record<string, unknown>, name: string): string {
  const value = data[name];
  if (typeof value !== "string" || value.trim() === "") throw new HttpsError("invalid-argument", `${name} is required`);
  return value;
}

function mapJobError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (isDomainError(error)) {
    const code = error.code === "permission_denied" ? "permission-denied"
      : error.code === "invalid_input" ? "invalid-argument"
      : error.code === "session_expired" ? "deadline-exceeded"
      : error.code === "bin_busy" ? "aborted"
      : "failed-precondition";
    return new HttpsError(code, error.message);
  }
  return new HttpsError("internal", "Worker gateway operation failed");
}

function httpStatus(code: string): number {
  if (code === "unauthenticated") return 401;
  if (code === "permission-denied") return 403;
  if (code === "invalid-argument") return 400;
  if (code === "internal") return 500;
  return 409;
}

function isRetryable(code: string): boolean {
  return code === "aborted" || code === "unavailable" || code === "deadline-exceeded";
}
