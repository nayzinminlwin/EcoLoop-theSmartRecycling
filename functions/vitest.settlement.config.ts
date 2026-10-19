import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/emulator/settlement.test.ts"],
    hookTimeout: 30000,
  },
});
