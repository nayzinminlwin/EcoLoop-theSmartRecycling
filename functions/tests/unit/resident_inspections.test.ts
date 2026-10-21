import { describe, expect, it, vi } from "vitest";
import { dispatchCommittedSubmission } from "../../src/transport/resident_inspections.js";
import type { Dispatcher } from "../../src/infrastructure/cloud_tasks.js";
import { StructuredLogger } from "../../src/infrastructure/logger.js";
import type { InspectionSubmission } from "../../src/infrastructure/firestore/inspection_store.js";

const submission: InspectionSubmission = {
  batchId: "deposit-1",
  jobId: "job-1",
  resultId: "result-1",
  sessionId: "session-1",
  ownerId: "resident-1",
  assetId: "asset-demo-0010",
  assetVersion: "1",
  assetContentSha256: "sha",
  policyVersion: "policy-v1",
  cycleId: "cycle-1",
  submittedAt: "2026-10-21T00:00:00.000Z",
  deadlineAt: "2026-10-21T00:00:30.000Z",
  traceId: "trace-1",
  dispatchState: "pending",
  operationState: "applied",
};

describe("dispatchCommittedSubmission", () => {
  it("awaits dispatch and reports the durable dispatched state", async () => {
    const dispatcher: Dispatcher = {
      dispatchJob: vi.fn().mockResolvedValue({
        jobId: submission.jobId,
        taskName: "task-1",
        state: "dispatched",
      }),
      reconcilePending: vi.fn(),
    };
    const logger = new StructuredLogger("test", vi.fn());

    await expect(dispatchCommittedSubmission(dispatcher, logger, submission, submission.submittedAt))
      .resolves.toBe("dispatched");
    expect(dispatcher.dispatchJob).toHaveBeenCalledWith(submission.jobId, submission.submittedAt);
  });

  it("keeps the committed operation pending when enqueue fails", async () => {
    const dispatcher: Dispatcher = {
      dispatchJob: vi.fn().mockRejectedValue(new Error("tasks unavailable")),
      reconcilePending: vi.fn(),
    };
    const sink = vi.fn();
    const logger = new StructuredLogger("test", sink);

    await expect(dispatchCommittedSubmission(dispatcher, logger, submission, submission.submittedAt))
      .resolves.toBe("pending");
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({
      severity: "ERROR",
      event: "inspection.dispatch_enqueue_failed",
      jobId: submission.jobId,
    }));
  });
});
