import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Node is the default: the engines, exports and API helpers are server
    // code. Component suites opt into jsdom with a per-file docblock.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    css: false,
  },
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
