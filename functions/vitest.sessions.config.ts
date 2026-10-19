import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/emulator/sessions.test.ts"],
    passWithNoTests: false,
  },
});
