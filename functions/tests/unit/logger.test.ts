import { describe, expect, it } from "vitest";
import { StructuredLogger } from "../../src/infrastructure/logger.js";

describe("structured Functions logger", () => {
  it("keeps async request contexts separate and redacts secrets", async () => {
    const events: Record<string, unknown>[] = [];
    const logger = new StructuredLogger("emulator", (event) => events.push(event));
    await Promise.all([
      Promise.resolve().then(() => logger.withContext({ traceId: "a".repeat(32), requestId: "req-a" }, async () => {
        logger.log("INFO", "request.started", { token: "secret-a", url: "https://example.test/x?token=secret-a" });
      })),
      Promise.resolve().then(() => logger.withContext({ traceId: "b".repeat(32), requestId: "req-b" }, async () => {
        logger.error("request.failed", new Error("provider key=secret-b"), { voucherCode: "raw-code" });
      })),
    ]);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.traceId)).toEqual(expect.arrayContaining(["a".repeat(32), "b".repeat(32)]));
    expect(JSON.stringify(events)).not.toContain("secret-a");
    expect(JSON.stringify(events)).not.toContain("secret-b");
    expect(JSON.stringify(events)).not.toContain("raw-code");
  });
});
