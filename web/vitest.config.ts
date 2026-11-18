import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [".codex-tmp/**", "node_modules/**", "dist/**", "outputs/**"],
  },
});
