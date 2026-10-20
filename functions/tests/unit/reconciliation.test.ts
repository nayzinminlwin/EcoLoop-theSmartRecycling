import { describe, expect, it, vi } from "vitest";
import { reconcileMaintenance } from "../../src/application/maintenance.js";

describe("maintenance reconciliation orchestration", () => {
  it("returns each boundary result and preserves adapter failures", async () => {
    const dispatcher = { reconcilePending: vi.fn().mockResolvedValue({ dispatched: 2 }) };
    const store = {
      reconcileJobs: vi.fn().mockResolvedValue({ jobsRecovered: 1, jobsReferred: 0 }),
      expireAbandonedReservations: vi.fn().mockResolvedValue(3),
    };
    const settlements = {};

    await expect(reconcileMaintenance(
      store as never, dispatcher as never, settlements as never, "2026-10-19T05:00:00.000Z", 10,
    )).resolves.toEqual({
      dispatch: { dispatched: 2 }, jobsRecovered: 1, jobsReferred: 0, reservationsExpired: 3,
    });

    const failure = new Error("dispatcher interrupted");
    dispatcher.reconcilePending.mockRejectedValueOnce(failure);
    await expect(reconcileMaintenance(
      store as never, dispatcher as never, settlements as never, "2026-10-19T05:00:00.000Z",
    )).rejects.toBe(failure);
  });
});
