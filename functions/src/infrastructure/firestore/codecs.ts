import { Timestamp } from "firebase-admin/firestore";
import type { Instant } from "../../domain/types.js";

export function timestampToInstant(value: unknown): Instant {
  if (isTimestamp(value)) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  throw new TypeError("Expected a Firestore timestamp or ISO instant");
}

export function instantToTimestamp(value: Instant): Timestamp {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid instant");
  return Timestamp.fromDate(date);
}

function isTimestamp(value: unknown): value is Timestamp {
  return value !== null && typeof value === "object" &&
    typeof (value as Timestamp).toDate === "function" &&
    typeof (value as Timestamp).toMillis === "function";
}
