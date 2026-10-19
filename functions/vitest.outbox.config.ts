import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/emulator/outbox.test.ts"],
    hookTimeout: 30000,
  },
});
