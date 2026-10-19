import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/emulator/maintenance.test.ts"],
    hookTimeout: 30000,
  },
});
