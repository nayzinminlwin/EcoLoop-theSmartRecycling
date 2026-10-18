import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/emulator/rules.test.ts'],
    passWithNoTests: false,
  },
});
