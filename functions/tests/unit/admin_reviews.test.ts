import { describe, it, expect, beforeEach } from "vitest";
import {
  validateReviewDecisions,
  validateExplanation,
  validateTicketId,
  calculateReviewPlan,
  type ObjectResolutionDecision,
} from "../../src/domain/admin_reviews.js";
import { initialPolicy } from "../../src/domain/policy.js";
import { DomainError } from "../../src/domain/errors.js";

describe("Phase AB-07 — Admin Review Domain Validations & Calculations", () => {
  const policy = initialPolicy();

  describe("Validation", () => {
    it("validates ticket ID and explanation length", () => {
      expect(validateTicketId("ticket-101")).toBe("ticket-101");
      expect(() => validateTicketId("")).toThrow(DomainError);

      expect(validateExplanation("Visual review confirmed items.")).toBe(
        "Visual review confirmed items."
      );
      expect(() => validateExplanation("ok")).toThrow(DomainError);
      expect(() => validateExplanation("a".repeat(301))).toThrow(DomainError);
    });

    it("enforces inventoryState invariants", () => {
      // Empty must have 0 objects
      expect(() =>
        validateReviewDecisions("empty", [
          { objectId: "obj-1", resolvedClass: "plastic_bottle", decision: "accept" },
        ])
      ).toThrow(DomainError);

      // Unreadable must have 0 objects
      expect(() =>
        validateReviewDecisions("unreadable", [
          { objectId: "obj-1", resolvedClass: "plastic_bottle", decision: "accept" },
        ])
      ).toThrow(DomainError);

      // Resolved cannot have unknown class
      expect(() =>
        validateReviewDecisions("resolved", [
          { objectId: "obj-1", resolvedClass: "unknown", decision: "accept" },
        ])
      ).toThrow(DomainError);

      // Max 32 objects
      const tooMany: ObjectResolutionDecision[] = Array.from({ length: 33 }, (_, i) => ({
        objectId: `obj-${i}`,
        resolvedClass: "plastic_bottle",
        decision: "accept",
      }));
      expect(() => validateReviewDecisions("resolved", tooMany)).toThrow(DomainError);
    });
  });

  describe("Arithmetic & Calculations", () => {
    it("resolves empty inventory: 0 points, 0 spc, negative space correction", () => {
      // Golden case: ab01-empty-resolution
      const plan = calculateReviewPlan(policy, "empty", [], 50);

      expect(plan.outcome).toBe("empty");
      expect(plan.pointsAwarded).toBe(0);
      expect(plan.totalDetectedObjectCount).toBe(0);
      expect(plan.spaceContributionSpc).toBe(0);
      expect(plan.spaceDeltaSpc).toBe(-50);
      expect(plan.acceptedCount).toBe(0);
    });

    it("resolves unreadable/technical failure: rejected, 0 points, retains unreadable space (50 spc)", () => {
      // Golden case: ab01-technical-failure-review
      const plan = calculateReviewPlan(policy, "unreadable", [], 50);

      expect(plan.outcome).toBe("rejected");
      expect(plan.pointsAwarded).toBe(0);
      expect(plan.totalDetectedObjectCount).toBeNull();
      expect(plan.spaceContributionSpc).toBe(50);
      expect(plan.spaceDeltaSpc).toBe(0);
      expect(plan.acceptedCount).toBe(0);
    });

    it("resolves mixed batch: 1 plastic bottle (accept) + 1 paper bag (accept) -> 13 points, 28 spc, -2 correction", () => {
      // Golden case: ab01-mixed-batch-resolution / exit gate
      // Policy rates: plastic_bottle = 5 pts, 10 spc; paper_bag = 3 pts, 8 spc
      // 1 bottle + 1 paper bag = 8 pts, 18 spc
      // Wait, in the exit gate: "Two bottles + one unknown: hold null points and 30 spc; resolve unknown to paper bag -> 13 points, 28 spc, -2 correction"
      const objects: ObjectResolutionDecision[] = [
        { objectId: "obj-1", resolvedClass: "plastic_bottle", decision: "accept" },
        { objectId: "obj-2", resolvedClass: "plastic_bottle", decision: "accept" },
        { objectId: "obj-3", resolvedClass: "paper_bag", decision: "accept" },
      ];

      // Two plastic bottles (2 * 5 = 10 pts, 2 * 10 = 20 spc)
      // One paper bag (3 pts, 8 spc)
      // Total points: 13, Total space: 28 spc. Provisional space was 30 spc. Delta = 28 - 30 = -2 spc!
      const plan = calculateReviewPlan(policy, "resolved", objects, 30);

      expect(plan.outcome).toBe("verified");
      expect(plan.pointsAwarded).toBe(13);
      expect(plan.spaceContributionSpc).toBe(28);
      expect(plan.spaceDeltaSpc).toBe(-2);
      expect(plan.acceptedCount).toBe(3);
    });

    it("excludes cardboard from receiving points while tracking its space occupancy", () => {
      const objects: ObjectResolutionDecision[] = [
        { objectId: "obj-1", resolvedClass: "plastic_bottle", decision: "accept" },
        { objectId: "obj-2", resolvedClass: "cardboard_item", decision: "exclude" },
      ];

      // 1 plastic bottle: 5 pts, 10 spc
      // 1 cardboard (excluded): 0 pts, 15 spc
      // Total space: 25 spc, Total points: 5 pts
      const plan = calculateReviewPlan(policy, "resolved", objects, 20);

      expect(plan.outcome).toBe("verified");
      expect(plan.pointsAwarded).toBe(5);
      expect(plan.spaceContributionSpc).toBe(25);
      expect(plan.spaceDeltaSpc).toBe(5);
      expect(plan.acceptedCount).toBe(1);
    });

    it("resolves all excluded objects as rejected outcome with 0 points", () => {
      const objects: ObjectResolutionDecision[] = [
        { objectId: "obj-1", resolvedClass: "cardboard_item", decision: "exclude" },
      ];

      const plan = calculateReviewPlan(policy, "resolved", objects, 20);

      expect(plan.outcome).toBe("rejected");
      expect(plan.pointsAwarded).toBe(0);
      expect(plan.spaceContributionSpc).toBe(15);
      expect(plan.spaceDeltaSpc).toBe(-5);
      expect(plan.acceptedCount).toBe(0);
    });
  });
});
