import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Webhook and AI tests must never reach the network.
    env: { NODE_ENV: "test", AI_PROVIDER: "mock" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
