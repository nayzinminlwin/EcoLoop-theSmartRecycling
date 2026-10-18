import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/emulator/seed.test.ts"],
    passWithNoTests: false,
  },
});
