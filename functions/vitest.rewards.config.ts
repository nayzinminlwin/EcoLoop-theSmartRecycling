import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/emulator/rewards.test.ts"],
    hookTimeout: 30000,
  },
});
