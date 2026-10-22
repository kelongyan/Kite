import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name)
    ) {
      files.push(path);
    }
  }
  return files;
}

describe("motion contract", () => {
  it("keeps raw durations, easings, and transition-all out of components", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      const path = relative(ROOT, file);
      if (/\btransition-all\b/.test(text)) {
        offenders.push(`${path}: transition-all`);
      }
      const durations = text.match(
        /\bduration-(?:75|100|150|200|300|500|700|1000)\b/g,
      );
      if (durations) offenders.push(`${path}: ${durations.join(", ")}`);
      const easings = text.match(
        /\bease-(?:in-out|linear|in|out)\b/g,
      );
      if (easings) offenders.push(`${path}: ${easings.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("defines the shared motion tokens and overlay recipes", () => {
    const css = readFileSync(join(SRC, "styles", "globals.css"), "utf8");
    for (const token of [
      "--dur-instant",
      "--dur-fast",
      "--dur-base",
      "--dur-slow",
      "--ease-premium",
      "--ease-soft",
    ]) {
      expect(css).toContain(token);
    }
    for (const className of [
      ".kite-overlay-motion",
      ".kite-dialog-motion",
      ".kite-command-motion",
      ".kite-popover-motion",
    ]) {
      expect(css).toContain(className);
    }
  });
});
