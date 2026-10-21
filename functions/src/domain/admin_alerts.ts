// =============================================================================
// admin_alerts.ts — Domain logic & state machine for smart bin capacity alerts
// Phase AB-06 — Capacity alerts and collection-cycle workflow
// =============================================================================

import { HttpsError } from "firebase-functions/v2/https";

export type AlertLifecycleState = "pending" | "scheduled" | "collected" | "resolved";

export interface CapacityAlertDocument {
  readonly id: string;
  readonly binId: string;
  readonly locationName: string;
  readonly cycleId: string;
  readonly thresholdSnapshot: 75 | 80 | 85;
  readonly operationalSettingsVersion: number;
  readonly triggeringOccupiedSpc: number;
  readonly triggeringCapacitySpc: number;
  readonly triggeringFillPercent: number;
  readonly currentFillPercent: number;
  readonly state: AlertLifecycleState;
  readonly version: number;
  readonly triggeredAt: string;
  readonly scheduledAt: string | null;
  readonly scheduledBy: string | null;
  readonly collectedAt: string | null;
  readonly collectedBy: string | null;
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
  readonly collectionEventId: string | null;
  readonly updatedAt: string;
}

export interface BinCollectionStateDocument {
  readonly binId: string;
  readonly currentCycleId: string;
  readonly status: "normal" | "alert_pending" | "collection_scheduled" | "cycle_collected";
  readonly activeAlertId: string | null;
  readonly lastCollectedAt: string | null;
  readonly lastCollectedBy: string | null;
  readonly lastCollectionEventId: string | null;
  readonly updatedAt: string;
}

export interface ScheduleCollectionInput {
  readonly alertId: string;
  readonly expectedVersion: number;
}

export interface RecordCollectionInput {
  readonly binId: string;
  readonly expectedCycleId: string;
  readonly notes?: string;
}

export interface ResolveCapacityAlertInput {
  readonly alertId: string;
  readonly expectedVersion: number;
}

/**
 * Deterministic alert ID marker: exactly one alert per bin + cycle.
 */
export function computeAlertId(binId: string, cycleId: string): string {
  const cleanBin = binId.trim().toLowerCase();
  const cleanCycle = cycleId.trim().toLowerCase();
  return `alert-${cleanBin}-${cleanCycle}`;
}

/**
 * Validates alert ID format.
 */
export function validateAlertId(alertId: string): void {
  if (!alertId || typeof alertId !== "string" || alertId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "alertId is required.");
  }
  if (!/^alert-[a-z0-9._:-]+-[a-z0-9._:-]+$/i.test(alertId)) {
    throw new HttpsError("invalid-argument", `Invalid alertId format: "${alertId}".`);
  }
}

/**
 * Validates expectedVersion is a non-negative integer.
 */
export function validateExpectedVersion(expectedVersion: number): void {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new HttpsError(
      "invalid-argument",
      "expectedVersion must be a non-negative integer."
    );
  }
}

/**
 * Validates expectedCycleId is a non-empty string.
 */
export function validateExpectedCycleId(cycleId: string): void {
  if (!cycleId || typeof cycleId !== "string" || cycleId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "expectedCycleId is required.");
  }
}

/**
 * Validates transition in the alert lifecycle state machine:
 * pending -> scheduled -> collected -> resolved
 */
export function validateAlertTransition(
  currentState: AlertLifecycleState,
  targetState: AlertLifecycleState
): void {
  const allowedTransitions: Record<AlertLifecycleState, readonly AlertLifecycleState[]> = {
    pending: ["scheduled", "collected"], // Allow direct collect if field crew collects without scheduling
    scheduled: ["collected"],
    collected: ["resolved"],
    resolved: [],
  };

  const allowed = allowedTransitions[currentState];
  if (!allowed || !allowed.includes(targetState)) {
    throw new HttpsError(
      "failed-precondition",
      `Invalid alert transition from "${currentState}" to "${targetState}".`
    );
  }
}

/**
 * Evaluates whether occupiedSpc crosses or meets thresholdPercent.
 * Formula: round((occupiedSpc / capacitySpc) * 100) >= thresholdPercent
 */
export function shouldTriggerAlert(
  occupiedSpc: number,
  capacitySpc: number,
  thresholdPercent: number
): boolean {
  if (capacitySpc <= 0) return false;
  const rawFill = Math.round((Math.max(0, occupiedSpc) / capacitySpc) * 100);
  return rawFill >= thresholdPercent;
}

/**
 * Computes next cycle ID following a collection.
 */
export function computeNextCycleId(binId: string, currentCycleId: string): string {
  const cleanBin = binId.trim();
  // Try to parse existing cycle sequence or fallback to timestamp-based sequence
  const match = currentCycleId.match(/-cycle-(\d+)$/i);
  if (match && match[1]) {
    const nextSeq = parseInt(match[1], 10) + 1;
    const padded = String(nextSeq).padStart(3, "0");
    return `${cleanBin}-cycle-${padded}`;
  }
  return `${cleanBin}-cycle-${Date.now().toString(36)}`;
}

/**
 * Computes collection event ID deterministically from bin and request/timestamp.
 */
export function computeCollectionEventId(binId: string, requestId: string): string {
  const cleanReq = requestId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  return `collection-${binId.trim()}-${cleanReq}`;
}
