// =============================================================================
// admin_settings.ts — Domain rules and invariants for admin program settings
// Phase AB-05 — Immutable program settings and future-policy publication
// =============================================================================

import { randomUUID } from "node:crypto";
import type { CanonicalClass, RewardCategory } from "./types.js";
import type { PolicySnapshot } from "./policy.js";

export type CapacityAlertThreshold = 75 | 80 | 85;

export const VALID_THRESHOLDS: readonly CapacityAlertThreshold[] = Object.freeze([75, 80, 85]);

export const ALLOWED_PROGRAM_CLASSES: readonly CanonicalClass[] = Object.freeze([
  "plastic_bottle",
  "aluminium_can",
  "glass_bottle",
  "paper_item",
  "paper_bag",
]);

export const EXCLUDED_PROGRAM_CLASSES: readonly CanonicalClass[] = Object.freeze([
  "cardboard_item",
  "other",
  "unknown",
]);

export interface MaterialRateInput {
  readonly materialType: RewardCategory;
  readonly pointsPerItem: number;
  readonly eligible: boolean;
}

export interface PublishSettingsInput {
  readonly expectedVersion: number;
  readonly capacityAlertThreshold: CapacityAlertThreshold;
  readonly acceptedClasses: readonly CanonicalClass[];
  readonly materialRates: readonly MaterialRateInput[];
}

export interface AdminSettingsDTO {
  readonly id: "global";
  readonly version: number;
  readonly policyVersion: string;
  readonly capacityAlertThreshold: CapacityAlertThreshold;
  readonly acceptedClasses: readonly CanonicalClass[];
  readonly acceptedMaterials: readonly RewardCategory[];
  readonly materialRates: readonly {
    readonly materialType: RewardCategory;
    readonly displayName: string;
    readonly pointsPerItem: number;
    readonly eligible: boolean;
  }[];
  readonly updatedAt: string;
}

export function validateThreshold(threshold: unknown): asserts threshold is CapacityAlertThreshold {
  if (
    typeof threshold !== "number" ||
    !Number.isInteger(threshold) ||
    !VALID_THRESHOLDS.includes(threshold as CapacityAlertThreshold)
  ) {
    throw new Error(
      `valid_threshold_enum_required: Alert threshold must be one of [${VALID_THRESHOLDS.join(", ")}]. Received: ${threshold}`
    );
  }
}

export function validateAcceptedClasses(classes: unknown): asserts classes is readonly CanonicalClass[] {
  if (!Array.isArray(classes) || classes.length === 0) {
    throw new Error("accepted_classes_required: At least one accepted material class must be selected.");
  }

  const seen = new Set<CanonicalClass>();
  for (const item of classes) {
    if (typeof item !== "string") {
      throw new Error("invalid_accepted_class: Each accepted class must be a valid string.");
    }
    const canonical = item as CanonicalClass;
    if (canonical === "cardboard_item") {
      throw new Error(
        "cardboard_excluded: Cardboard is excluded from program acceptance in smart bins."
      );
    }
    if (!ALLOWED_PROGRAM_CLASSES.includes(canonical)) {
      throw new Error(
        `invalid_accepted_class: "${item}" is not an allowable accepted class. Allowed: [${ALLOWED_PROGRAM_CLASSES.join(", ")}].`
      );
    }
    if (seen.has(canonical)) {
      throw new Error(`duplicate_accepted_class: Duplicate class "${item}" in accepted classes list.`);
    }
    seen.add(canonical);
  }
}

export function validateRates(rates: unknown): asserts rates is readonly MaterialRateInput[] {
  if (!Array.isArray(rates) || rates.length === 0) {
    throw new Error("material_rates_required: At least one material rate must be configured.");
  }

  const validCategories: RewardCategory[] = ["plastic", "aluminium", "paper", "glass"];
  const seenCategories = new Set<RewardCategory>();

  for (const r of rates) {
    if (!r || typeof r !== "object") {
      throw new Error("invalid_material_rate: Each material rate must be an object.");
    }
    const cat = r.materialType as RewardCategory;
    if (!validCategories.includes(cat)) {
      throw new Error(`invalid_material_type: "${r.materialType}" is not a recognized material category.`);
    }
    if (seenCategories.has(cat)) {
      throw new Error(`duplicate_material_rate: Duplicate rate for category "${cat}".`);
    }
    seenCategories.add(cat);

    const pts = r.pointsPerItem;
    if (typeof pts !== "number" || !Number.isInteger(pts) || pts < 0 || pts > 1000) {
      throw new Error(
        `invalid_points_per_item: Points for "${cat}" must be a non-negative integer between 0 and 1000. Received: ${pts}`
      );
    }

    if (typeof r.eligible !== "boolean") {
      throw new Error(`invalid_eligible_flag: Eligible flag for "${cat}" must be a boolean.`);
    }
  }
}

export function hasPolicyChanged(
  currentPolicy: PolicySnapshot,
  newClasses: readonly CanonicalClass[],
  newRates: readonly MaterialRateInput[]
): boolean {
  // Compare accepted object classes
  const currentSorted = [...currentPolicy.acceptedObjectClasses].sort();
  const nextSorted = [...newClasses].sort();
  if (currentSorted.length !== nextSorted.length) return true;
  for (let i = 0; i < currentSorted.length; i++) {
    if (currentSorted[i] !== nextSorted[i]) return true;
  }

  // Compare points per category
  for (const r of newRates) {
    const currentPts = currentPolicy.pointsPerItemByCategory[r.materialType] ?? 0;
    if (currentPts !== r.pointsPerItem) return true;
  }

  return false;
}

export function hasThresholdChanged(
  currentThreshold: number,
  newThreshold: CapacityAlertThreshold
): boolean {
  return currentThreshold !== newThreshold;
}

export function generatePolicyId(): string {
  // Pattern matching: ^policy-[a-f0-9]{8}$
  return `policy-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export function createNextPolicy(
  previousPolicy: PolicySnapshot,
  newPolicyId: string,
  acceptedClasses: readonly CanonicalClass[],
  materialRates: readonly MaterialRateInput[]
): PolicySnapshot {
  const pointsMap: Record<string, number> = { ...previousPolicy.pointsPerItemByCategory };
  for (const r of materialRates) {
    pointsMap[r.materialType] = r.pointsPerItem;
  }

  return {
    id: newPolicyId,
    acceptedObjectClasses: [...acceptedClasses],
    rewardCategoryByClass: { ...previousPolicy.rewardCategoryByClass },
    pointsPerItemByCategory: Object.freeze(pointsMap),
    spcPerItemByClass: { ...previousPolicy.spcPerItemByClass },
    defaultSpcPerRecognizedItem: previousPolicy.defaultSpcPerRecognizedItem,
    unresolvedSpcPerCandidate: previousPolicy.unresolvedSpcPerCandidate,
    unreadableBatchSpc: previousPolicy.unreadableBatchSpc,
  };
}
