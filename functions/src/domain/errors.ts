export type DomainErrorCode =
  | "unauthenticated"
  | "permission_denied"
  | "invalid_qr"
  | "bin_full"
  | "bin_busy"
  | "bin_unavailable"
  | "processing_unavailable"
  | "active_session_exists"
  | "session_expired"
  | "invalid_transition"
  | "asset_unavailable"
  | "asset_version_changed"
  | "already_submitted"
  | "idempotency_conflict"
  | "offer_changed"
  | "reward_unavailable"
  | "redemption_limit_reached"
  | "insufficient_points"
  | "voucher_expired"
  | "voucher_used"
  | "unsupported_version"
  | "invalid_input"
  | "internal";

export type ErrorRetryability = "never" | "after_refresh" | "after_backoff";

export interface SafeErrorDetails {
  readonly field?: string;
  readonly conflictVersion?: number;
  readonly operationId?: string;
}

export interface DomainErrorOptions {
  readonly retryability?: ErrorRetryability;
  readonly details?: SafeErrorDetails;
  readonly cause?: unknown;
}

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly retryability: ErrorRetryability;
  readonly details: SafeErrorDetails | undefined;

  constructor(
    code: DomainErrorCode,
    message: string,
    options: DomainErrorOptions = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.retryability = options.retryability ?? "never";
    this.details = options.details;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  get retryable(): boolean {
    return this.retryability !== "never";
  }

  toSafeResponse(): {
    readonly code: DomainErrorCode;
    readonly message: string;
    readonly retryable: boolean;
    readonly details?: SafeErrorDetails;
  } {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
