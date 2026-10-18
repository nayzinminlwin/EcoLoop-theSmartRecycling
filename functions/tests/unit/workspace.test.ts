import { describe, expect, it } from "vitest";
import { DomainError } from "../../src/domain/errors.js";
import type { DepositBatch } from "../../src/domain/types.js";

describe("domain workspace", () => {
  it("loads SDK-free domain types and exposes safe retry semantics", () => {
    const batch: Pick<DepositBatch, "pointsAwarded" | "totalDetectedObjectCount"> = {
      pointsAwarded: null,
      totalDetectedObjectCount: null,
    };
    const error = new DomainError("processing_unavailable", "Processing is temporarily unavailable", {
      retryability: "after_backoff",
    });

    expect(batch.pointsAwarded).toBeNull();
    expect(batch.totalDetectedObjectCount).toBeNull();
    expect(error.toSafeResponse()).toEqual({
      code: "processing_unavailable",
      message: "Processing is temporarily unavailable",
      retryable: true,
    });
  });
});
