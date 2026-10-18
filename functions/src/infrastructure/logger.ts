import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export interface LogContext {
  readonly interactionId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly sessionId?: string;
  readonly depositId?: string;
  readonly jobId?: string;
  readonly attemptId?: string;
  readonly decisionVersion?: number;
  readonly policyVersionId?: string;
  readonly pipelineVersionId?: string;
}

export interface LogEvent extends LogContext {
  readonly timestamp: string;
  readonly severity: LogLevel;
  readonly event: string;
  readonly service: "firebase-functions";
  readonly environment: string;
  readonly unit?: string;
  readonly schemaVersion: 1;
  readonly [key: string]: unknown;
}

export type EventSink = (event: LogEvent) => void;

const contextStorage = new AsyncLocalStorage<LogContext>();
const secretKey = /token|authorization|api[-_]?key|secret|password|voucher(code)?|registration/i;
const sensitiveUrlKey = /[?&](token|key|signature|sig|auth|code)=[^&]*/gi;
const sensitiveAssignment = /\b(token|key|secret|password|authorization)\s*=\s*[^\s,;]+/gi;

function redact(value: unknown, key?: string, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (key !== undefined && secretKey.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    return value
      .replace(sensitiveUrlKey, (match) => `${match.slice(0, match.indexOf("=") + 1)}[REDACTED]`)
      .replace(sensitiveAssignment, (match) => `${match.slice(0, match.indexOf("=") + 1)}[REDACTED]`);
  }
  if (Array.isArray(value)) return value.slice(0, 32).map((entry) => redact(entry, undefined, depth + 1));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).slice(0, 64).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey, depth + 1)]),
    );
  }
  return value;
}

function safeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorCode: error.name,
      errorMessage: redact(error.message.slice(0, 240)),
    };
  }
  return { errorCode: "UnknownError", errorMessage: "Unexpected failure" };
}

export class StructuredLogger {
  constructor(
    private readonly environment: string,
    private readonly sink: EventSink = (event) => console.log(JSON.stringify(event)),
    private readonly unit?: string,
  ) {}

  withContext<T>(context: LogContext, callback: () => T): T {
    return contextStorage.run({ ...contextStorage.getStore(), ...context }, callback);
  }

  context(): LogContext {
    return contextStorage.getStore() ?? {};
  }

  log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
    const payload = redact(fields) as Record<string, unknown>;
    this.sink({
      ...this.context(),
      timestamp: new Date().toISOString(),
      severity: level,
      event,
      service: "firebase-functions",
      environment: this.environment,
      ...(this.unit === undefined ? {} : { unit: this.unit }),
      schemaVersion: 1,
      ...payload,
    });
  }

  error(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
    this.log("ERROR", event, { ...fields, ...safeError(error) });
  }
}
