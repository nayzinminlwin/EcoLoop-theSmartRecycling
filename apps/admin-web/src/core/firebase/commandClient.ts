// =============================================================================
// commandClient.ts — Trusted administrative command transport and recovery client
// Phase AB-02 — Intent generation, idempotent command execution, and error mapping
// =============================================================================

import { httpsCallable, type Functions, type HttpsCallableOptions } from "firebase/functions";
import { RepositoryError, type FailureCode } from "../../data/repositories.ts";

export interface CommandEnvelope<T> {
  readonly schemaVersion: "admin.v1";
  readonly operation: string;
  readonly requestId: string;
  readonly payload: T;
}

export interface CommandReceipt<R = Record<string, unknown>> {
  readonly schemaVersion: "admin.v1";
  readonly operation: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly status: "committed";
  readonly data: R;
}

export class FirebaseCommandClient {
  private readonly functions: Functions;

  constructor(functions: Functions) {
    this.functions = functions;
  }

  generateRequestId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `req-${crypto.randomUUID()}`;
    }
    return `req-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
  }

  async execute<T extends Record<string, unknown>, R = Record<string, unknown>>(
    operation: string,
    payload: T,
    explicitRequestId?: string,
    options?: HttpsCallableOptions
  ): Promise<CommandReceipt<R>> {
    const requestId = explicitRequestId ?? this.generateRequestId();
    const callable = httpsCallable<CommandEnvelope<T>, CommandReceipt<R>>(
      this.functions,
      operation,
      options
    );

    const envelope: CommandEnvelope<T> = {
      schemaVersion: "admin.v1",
      operation,
      requestId,
      payload,
    };

    try {
      const response = await callable(envelope);
      return response.data;
    } catch (err: unknown) {
      throw this.mapFirebaseError(err, operation);
    }
  }

  async recover<R = Record<string, unknown>>(targetRequestId: string): Promise<CommandReceipt<R>> {
    const callable = httpsCallable<{ payload: { targetRequestId: string } }, CommandReceipt<R>>(
      this.functions,
      "recoverAdminOperation"
    );

    try {
      const response = await callable({
        payload: { targetRequestId },
      });
      return response.data;
    } catch (err: unknown) {
      throw this.mapFirebaseError(err, "recoverAdminOperation");
    }
  }

  mapFirebaseError(err: unknown, operation: string): RepositoryError {
    const errorObj = err as { code?: string; message?: string; details?: unknown };
    const fbCode = errorObj.code ?? "";
    const message = errorObj.message ?? `Operation ${operation} failed`;

    let code: FailureCode = "unavailable";
    if (fbCode.includes("unauthenticated")) {
      code = "unauthenticated";
    } else if (fbCode.includes("permission-denied")) {
      code = "permissionDenied";
    } else if (fbCode.includes("not-found")) {
      code = "notFound";
    } else if (fbCode.includes("already-exists") || fbCode.includes("failed-precondition")) {
      code = "conflict";
    } else if (fbCode.includes("invalid-argument")) {
      code = "validation";
    }

    return new RepositoryError({
      code,
      message,
      fieldErrors: {},
    });
  }
}
