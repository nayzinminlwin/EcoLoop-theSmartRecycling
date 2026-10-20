import { describe, expect, it, vi } from "vitest";
import { redeemReward, useDemoVoucher } from "../../src/application/rewards.js";
import { DomainError } from "../../src/domain/errors.js";

describe("reward application validation", () => {
  it("passes the displayed offer contract and stable fingerprint to the store", async () => {
    const store = { redeem: vi.fn().mockResolvedValue({ replayed: false }) } as never;
    await redeemReward(store, { uid: "resident-1" }, "request-1", {
      rewardId: "reward-demo-coffee", offerVersion: "v1", displayedCost: 25,
    }, "2026-10-19T00:00:00.000Z");
    expect(store.redeem).toHaveBeenCalledWith(expect.objectContaining({
      uid: "resident-1", requestId: "request-1", rewardId: "reward-demo-coffee",
      offerVersion: "v1", displayedCost: 25,
      payloadFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it("rejects invalid redemption input before touching the store", async () => {
    const store = { redeem: vi.fn() } as never;
    await expect(redeemReward(store, { uid: "resident-1" }, "request-1", {
      rewardId: "reward-demo-coffee", offerVersion: "v1", displayedCost: 25.5,
    }, "2026-10-19T00:00:00.000Z")).rejects.toBeInstanceOf(DomainError);
    expect(store.redeem).not.toHaveBeenCalled();
  });

  it("binds voucher use to the authenticated resident and request", async () => {
    const store = { useVoucher: vi.fn().mockResolvedValue({ replayed: false }) } as never;
    await useDemoVoucher(store, { uid: "resident-1" }, "request-2", { voucherId: "voucher-1" }, "2026-10-19T00:00:00.000Z");
    expect(store.useVoucher).toHaveBeenCalledWith(expect.objectContaining({
      uid: "resident-1", requestId: "request-2", voucherId: "voucher-1",
    }));
  });
});
