import { describe, expect, it } from "vitest";
import { canUseDemoVoucher, hasReachedResidentRewardLimit } from "../../src/domain/reward_policy.js";

describe("voucher policy", () => {
  it("requires demo, available, and unexpired state", () => {
    const base = {
      demo: true,
      status: "available",
      expiresAt: "2026-10-20T00:00:00.000Z",
      now: "2026-10-19T00:00:00.000Z",
    };
    expect(canUseDemoVoucher(base)).toBe(true);
    expect(canUseDemoVoucher({ ...base, demo: false })).toBe(false);
    expect(canUseDemoVoucher({ ...base, status: "used" })).toBe(false);
    expect(canUseDemoVoucher({ ...base, expiresAt: "2026-10-18T00:00:00.000Z" })).toBe(false);
  });

  it("enforces the configured resident lifetime limit", () => {
    expect(hasReachedResidentRewardLimit(0, 1)).toBe(false);
    expect(hasReachedResidentRewardLimit(1, 1)).toBe(true);
    expect(hasReachedResidentRewardLimit(2, 3)).toBe(false);
    expect(hasReachedResidentRewardLimit(3, 3)).toBe(true);
  });
});
