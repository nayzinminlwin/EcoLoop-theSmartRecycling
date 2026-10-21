// =============================================================================
// admin_reviews.ts — Review resolution domain model and calculation rules
// Phase AB-07 — Pinned-policy finalization, object decision recomputation, & fencing
// =============================================================================

import { DomainError } from "./errors.js";
import type { PolicySnapshot, FinalizationPlan } from "./policy.js";
import { calculateFinalization, initialPolicy } from "./policy.js";
import type { CanonicalClass, InventoryState, WorkerFinding } from "./types.js";

export const ALLOWED_CANONICAL_CLASSES: readonly CanonicalClass[] = Object.freeze([
  "plastic_bottle",
  "aluminium_can",
  "glass_bottle",
  "paper_item",
  "paper_bag",
  "cardboard_item",
  "other",
  "unknown",
]);

export interface ObjectResolutionDecision {
  readonly objectId: string;
  readonly resolvedClass: CanonicalClass;
  readonly decision: "accept" | "exclude";
  readonly note?: string;
}

export interface ReviewResolutionInput {
  readonly ticketId: string;
  readonly expectedDecisionVersion: number;
  readonly inventoryState: InventoryState;
  readonly objects: readonly ObjectResolutionDecision[];
  readonly explanation: string;
}

export interface ReviewPreviewInput {
  readonly ticketId: string;
  readonly inventoryState: InventoryState;
  readonly objects: readonly ObjectResolutionDecision[];
}

export interface ComputedReviewPlan {
  readonly outcome: "verified" | "rejected" | "empty";
  readonly totalDetectedObjectCount: number | null;
  readonly pointsAwarded: number;
  readonly spaceContributionSpc: number;
  readonly spaceDeltaSpc: number;
  readonly acceptedCount: number;
  readonly lines: FinalizationPlan["lines"];
  readonly reasonCodes: readonly string[];
  readonly policyVersion: string;
}

export function validateTicketId(ticketId: string): string {
  if (!ticketId || typeof ticketId !== "string" || ticketId.trim().length === 0) {
    throw new DomainError("invalid_input", "A valid ticket ID is required.", {
      details: { field: "ticketId" },
    });
  }
  return ticketId.trim();
}

export function validateExplanation(explanation: string): string {
  if (!explanation || typeof explanation !== "string") {
    throw new DomainError("invalid_input", "An explanation is required.", {
      details: { field: "explanation" },
    });
  }
  const trimmed = explanation.trim();
  if (trimmed.length < 3 || trimmed.length > 300) {
    throw new DomainError(
      "invalid_input",
      "Explanation must be between 3 and 300 characters.",
      { details: { field: "explanation" } },
    );
  }
  return trimmed;
}

export function validateReviewDecisions(
  inventoryState: InventoryState,
  objects: readonly ObjectResolutionDecision[],
): void {
  if (!["resolved", "empty", "unreadable", "uncertain"].includes(inventoryState)) {
    throw new DomainError("invalid_input", `Invalid inventoryState: ${inventoryState}`, {
      details: { field: "inventoryState" },
    });
  }

  if (inventoryState === "empty" && objects.length > 0) {
    throw new DomainError(
      "invalid_input",
      "Empty inventory resolution must have 0 objects.",
      { details: { field: "objects" } },
    );
  }

  if (inventoryState === "unreadable" && objects.length > 0) {
    throw new DomainError(
      "invalid_input",
      "Unreadable inventory resolution must have 0 objects.",
      { details: { field: "objects" } },
    );
  }

  if (objects.length > 32) {
    throw new DomainError(
      "invalid_input",
      "Review cannot contain more than 32 objects.",
      { details: { field: "objects" } },
    );
  }

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (!obj || !obj.objectId || typeof obj.objectId !== "string") {
      throw new DomainError("invalid_input", `Object at index ${i} is missing objectId.`, {
        details: { field: `objects[${i}].objectId` },
      });
    }
    if (!ALLOWED_CANONICAL_CLASSES.includes(obj.resolvedClass)) {
      throw new DomainError(
        "invalid_input",
        `Object at index ${i} has invalid class: ${obj.resolvedClass}`,
        { details: { field: `objects[${i}].resolvedClass` } },
      );
    }
    if (obj.decision !== "accept" && obj.decision !== "exclude") {
      throw new DomainError(
        "invalid_input",
        `Object at index ${i} has invalid decision: ${obj.decision}`,
        { details: { field: `objects[${i}].decision` } },
      );
    }
    if (inventoryState === "resolved" && obj.resolvedClass === "unknown") {
      throw new DomainError(
        "invalid_input",
        `Resolved inventory cannot contain unknown class on object ${obj.objectId}.`,
        { details: { field: `objects[${i}].resolvedClass` } },
      );
    }
  }
}

/**
 * Calculates review resolution using the exact pinned policy and domain arithmetic.
 */
export function calculateReviewPlan(
  policy: PolicySnapshot | undefined,
  inventoryState: InventoryState,
  objects: readonly ObjectResolutionDecision[],
  provisionalSpaceSpc: number,
): ComputedReviewPlan {
  const activePolicy = policy ?? initialPolicy();

  // 1. Empty inventory case
  if (inventoryState === "empty") {
    const finalSpace = 0;
    return {
      outcome: "empty",
      totalDetectedObjectCount: 0,
      pointsAwarded: 0,
      spaceContributionSpc: finalSpace,
      spaceDeltaSpc: finalSpace - provisionalSpaceSpc,
      acceptedCount: 0,
      lines: [],
      reasonCodes: ["empty_inventory_confirmed"],
      policyVersion: activePolicy.id,
    };
  }

  // 2. Unreadable / Technical failure case
  if (inventoryState === "unreadable") {
    const finalSpace = activePolicy.unreadableBatchSpc; // default 50 spc
    return {
      outcome: "rejected",
      totalDetectedObjectCount: null,
      pointsAwarded: 0,
      spaceContributionSpc: finalSpace,
      spaceDeltaSpc: finalSpace - provisionalSpaceSpc,
      acceptedCount: 0,
      lines: [],
      reasonCodes: ["unreadable_technical_failure"],
      policyVersion: activePolicy.id,
    };
  }

  // 3. Object-based resolution (resolved or uncertain)
  const findings: WorkerFinding[] = objects.map((obj) => {
    const isExcluded = obj.decision === "exclude";
    const isClassAcceptedByPolicy = activePolicy.acceptedObjectClasses.includes(obj.resolvedClass);
    return {
      objectId: obj.objectId,
      resolution: obj.resolvedClass,
      eligibility: !isExcluded && isClassAcceptedByPolicy ? "eligible" : "excluded",
      box: null,
      evidence: {
        modelIds: ["operator-admin"],
        rawLabel: obj.resolvedClass,
      },
      confidence: 1.0,
      reasonCode: isExcluded ? "fallback" : "matched",
    };
  });

  const plan = calculateFinalization(activePolicy, inventoryState, findings);

  let finalOutcome: "verified" | "rejected" | "empty";
  if (plan.status === "verified") {
    finalOutcome = "verified";
  } else if (plan.status === "empty") {
    finalOutcome = "empty";
  } else {
    finalOutcome = "rejected";
  }

  const points = plan.pointsAwarded ?? 0;
  const spaceDelta = plan.spaceContributionSpc - provisionalSpaceSpc;

  return {
    outcome: finalOutcome,
    totalDetectedObjectCount: plan.totalDetectedObjectCount,
    pointsAwarded: points,
    spaceContributionSpc: plan.spaceContributionSpc,
    spaceDeltaSpc: spaceDelta,
    acceptedCount: plan.acceptedCount ?? 0,
    lines: plan.lines,
    reasonCodes: plan.reasonCodes.length > 0 ? plan.reasonCodes : [finalOutcome],
    policyVersion: activePolicy.id,
  };
}
