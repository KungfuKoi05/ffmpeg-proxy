import "@testing-library/jest-dom/vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Load .env for tests without adding a dotenv dependency. Values already in the
 * environment win, so CI can override anything the local file sets.
 */
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

process.env.AUTH_SECRET ??= "test-secret-value-that-is-long-enough-to-pass";
