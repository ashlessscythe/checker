import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      "~": root,
    },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["utils/**/*.ts", "lib/**/*.ts"],
      exclude: [
        "**/*.test.*",
        "**/node_modules/**",
        ".next/**",
        "**/*.config.*",
        "components/**",
        "utils/lazyLoader.ts",
      ],
    },
  },
});
