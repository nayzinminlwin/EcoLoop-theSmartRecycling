import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    include: [
      "tests/emulator/concurrency.test.ts",
      "tests/emulator/authorization.test.ts",
      "tests/emulator/reconciliation.test.ts",
    ],
    hookTimeout: 30000,
  },
});
