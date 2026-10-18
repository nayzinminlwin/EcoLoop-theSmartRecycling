import { describe, expect, it } from "vitest";
import { canonicalPayload, createOperationIdentity } from "../../src/domain/identity.js";

describe("operation identity", () => {
  it("sorts object keys but preserves array order", () => {
    expect(canonicalPayload({ b: 2, a: [1, 2] })).toBe('{"a":[1,2],"b":2}');
    expect(canonicalPayload({ a: [2, 1] })).not.toBe(canonicalPayload({ a: [1, 2] }));
  });

  it("creates stable actor/request identity and fingerprints", () => {
    const first = createOperationIdentity("resident-1", "redeemReward", "request-1", { rewardId: "reward-cafe" });
    const second = createOperationIdentity("resident-1", "redeemReward", "request-1", { rewardId: "reward-cafe" });
    expect(first).toEqual(second);
    expect(first.operationKey).toBe("resident-1:redeemReward:request-1");
    expect(first.payloadFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
