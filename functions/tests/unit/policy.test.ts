import { describe, expect, it } from "vitest";
import { calculateFinalization, initialPolicy, type PolicySnapshot } from "../../src/domain/policy.js";
import type { WorkerFinding } from "../../src/domain/types.js";

const finding = (resolution: WorkerFinding["resolution"], eligibility: WorkerFinding["eligibility"] = "eligible"): WorkerFinding => ({
  objectId: `object-${resolution}`,
  resolution,
  eligibility,
  box: null,
  evidence: { modelIds: ["model-a"], rawLabel: resolution },
  confidence: 0.9,
});

describe("pure policy finalization", () => {
  it("matches the normal mixed golden outcome", () => {
    const findings = [
      finding("plastic_bottle"), finding("plastic_bottle"),
      finding("aluminium_can"), finding("aluminium_can"), finding("aluminium_can"),
      finding("paper_bag"), finding("cardboard_item", "excluded"),
    ];
    const plan = calculateFinalization(initialPolicy(), "resolved", findings);
    expect(plan.status).toBe("verified");
    expect(plan.totalDetectedObjectCount).toBe(7);
    expect(plan.acceptedCount).toBe(6);
    expect(plan.pointsAwarded).toBe(37);
    expect(plan.spaceContributionSpc).toBe(61);
  });

  it("distinguishes excluded, empty, unreadable, and unresolved states", () => {
    expect(calculateFinalization(initialPolicy(), "resolved", [finding("cardboard_item", "excluded")])).toMatchObject({
      status: "excluded", pointsAwarded: 0, spaceContributionSpc: 15,
    });
    expect(calculateFinalization(initialPolicy(), "empty", [])).toMatchObject({
      status: "empty", totalDetectedObjectCount: 0, pointsAwarded: 0, spaceContributionSpc: 0,
    });
    expect(calculateFinalization(initialPolicy(), "unreadable", [])).toMatchObject({
      status: "review", totalDetectedObjectCount: null, pointsAwarded: null, spaceContributionSpc: 50,
    });
    expect(calculateFinalization(initialPolicy(), "uncertain", [finding("unknown", "unresolved")])).toMatchObject({
      status: "review", pointsAwarded: null, spaceContributionSpc: 10,
    });
  });

  it("does not award invalid candidates or allow a broad policy mutation to affect a snapshot", () => {
    const policy = initialPolicy();
    const changedPolicy: PolicySnapshot = {
      ...policy,
      pointsPerItemByCategory: { ...policy.pointsPerItemByCategory, plastic: 99 },
    };
    const candidate = { ...finding("plastic_bottle"), reasonCode: "false_detection" as const };
    expect(calculateFinalization(policy, "resolved", [candidate]).totalDetectedObjectCount).toBe(0);
    expect(calculateFinalization(policy, "resolved", [finding("plastic_bottle")]).pointsAwarded).toBe(5);
    expect(calculateFinalization(changedPolicy, "resolved", [finding("plastic_bottle")]).pointsAwarded).toBe(99);
    expect(policy.id).toBe("policy-v1");
  });
});
