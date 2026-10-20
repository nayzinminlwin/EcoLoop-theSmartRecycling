import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/emulator/accounts.test.ts"],
    passWithNoTests: false,
  },
});
