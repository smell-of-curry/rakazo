import { defineConfig } from "vitest/config";

const nodeInclude = [
  ".agents/skills/pr-watch/*.test.ts",
  "packages/*/src/**/*.test.ts",
  "infra/sandboxes/supervisor/src/**/*.test.ts",
  "infra/updater/src/**/*.test.ts",
  "apps/desktop/src/**/*.test.ts",
  "apps/web/src/**/*.test.ts",
  "apps/mobile/lib/**/*.test.ts",
  "apps/api/src/**/*.test.ts",
  "apps/www/src/**/*.test.ts",
];

export default defineConfig({
  test: {
    setupFiles: ["./packages/testkit/src/pin-test-env.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "apps/web/src/**/*.{ts,tsx}",
        "apps/mobile/lib/**/*.{ts,tsx}",
        "packages/core/src/**/*.{ts,tsx}",
        "packages/adapters/src/**/*.{ts,tsx}",
        "packages/db/src/**/*.{ts,tsx}",
        "packages/contracts/src/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.{test,spec}.*", "**/*.d.ts"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: nodeInclude,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["apps/web/src/**/*.test.tsx", "packages/ui-web/src/**/*.test.tsx"],
          setupFiles: ["./packages/testkit/src/pin-test-env.ts", "./vitest.setup.ts"],
          sequence: { setupFiles: "list" },
        },
      },
    ],
  },
});
