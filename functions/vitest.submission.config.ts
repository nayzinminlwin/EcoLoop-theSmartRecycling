import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/emulator/submission.test.ts"],
    passWithNoTests: false,
  },
});
