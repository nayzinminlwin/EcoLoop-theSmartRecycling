import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateContract, validateNormalizedBox } from "../../src/transport/validation.js";

const validCommand = {
  schemaVersion: "backend.v1",
  operation: "submitInspection",
  requestId: "request-001",
  payload: {
    sessionId: "session-001",
    assetId: "asset-001",
    assetVersion: "v1",
    expectedVersion: 2,
  },
};

describe("runtime contract validation", () => {
  it("accepts strict commands and valid snapshot timestamps", async () => {
    await expect(validateContract("commands", validCommand)).resolves.toBeUndefined();
    await expect(validateContract("snapshots", {
      kind: "receipt",
      schemaVersion: "backend.v1",
      receiptId: "receipt-001",
      batchId: "batch-001",
      outcome: "empty",
      pointsAwarded: 0,
      spaceContributionSpc: 0,
      decisionVersion: 0,
      explanation: "No visible items were found.",
    })).resolves.toBeUndefined();
  });

  it("rejects owner and reward injection and preserves unknown as null", async () => {
    await expect(validateContract("commands", {
      ...validCommand,
      payload: { ...validCommand.payload, ownerId: "resident-other" },
    })).rejects.toThrow();
    await expect(validateContract("commands", {
      ...validCommand,
      payload: { ...validCommand.payload, pointsAwarded: 999 },
    })).rejects.toThrow();
    await expect(validateContract("snapshots", {
      kind: "batch",
      schemaVersion: "backend.v1",
      batchId: "batch-001",
      ownerId: "resident-001",
      sessionId: "session-001",
      assetId: "asset-001",
      policyVersion: "policy-v1",
      status: "review",
      totalDetectedObjectCount: null,
      pointsAwarded: null,
      spaceContributionSpc: 50,
      decisionVersion: 0,
    })).resolves.toBeUndefined();
  });

  it("enforces ordered normalized boxes and packages contracts during build", async () => {
    expect(() => validateNormalizedBox({ x1: 0.8, y1: 0.1, x2: 0.2, y2: 0.9 })).toThrow();
    expect(() => validateNormalizedBox({ x1: 0, y1: 0, x2: 1, y2: 1 })).not.toThrow();
    const packaged = resolve("lib", "contracts", "backend", "v1", "commands.schema.json");
    await expect(readFile(packaged, "utf8")).resolves.toContain('"backend.v1"');
  });
});
