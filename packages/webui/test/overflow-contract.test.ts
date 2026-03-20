import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const WEBUI_SRC_ROOT = path.resolve(import.meta.dirname, "../src");
const ALLOWLIST = new Set(["components/ui/accordion.tsx", "components/ui/overflow-surface.tsx"]);
const BACKGROUND_GUARD_FILES = new Map<string, string>([
  ["router.tsx", 'surfaceToneClassName("panel")'],
  ["features/shell/AppHeader.tsx", 'surfaceToneClassName("chrome")'],
  ["features/shell/BottomNavBar.tsx", 'surfaceToneClassName("chrome")'],
  ["features/shell/SidebarNav.tsx", 'surfaceToneClassName("chrome")'],
]);

const collectTsxFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const nextPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectTsxFiles(nextPath);
    }
    return entry.isFile() && nextPath.endsWith(".tsx") ? [nextPath] : [];
  });
};

const relativePath = (filePath: string): string => path.relative(WEBUI_SRC_ROOT, filePath).split(path.sep).join("/");

const findOverflowHiddenLines = (source: string): number[] => {
  return source.split("\n").flatMap((line, index) => (line.includes("overflow-hidden") ? [index + 1] : []));
};

describe("Feature: WebUI overflow source contract", () => {
  test("Scenario: Given WebUI source files When raw overflow-hidden appears Then only approved primitives keep it", () => {
    const violations = collectTsxFiles(WEBUI_SRC_ROOT)
      .map((filePath) => {
        const source = readFileSync(filePath, "utf8");
        const lines = findOverflowHiddenLines(source);
        return {
          file: relativePath(filePath),
          lines,
        };
      })
      .filter((entry) => entry.lines.length > 0 && !ALLOWLIST.has(entry.file))
      .map((entry) => `${entry.file}:${entry.lines.join(",")}`);

    expect(violations).toEqual([]);
  });

  test("Scenario: Given shell layout wrappers When semantic surfaces are used Then guarded files depend on the approved surface primitive", () => {
    const violations = collectTsxFiles(WEBUI_SRC_ROOT)
      .map((filePath) => {
        const file = relativePath(filePath);
        const expectedToken = BACKGROUND_GUARD_FILES.get(file);
        if (!expectedToken) {
          return null;
        }
        const source = readFileSync(filePath, "utf8");
        return source.includes(expectedToken) ? null : `${file} -> ${expectedToken}`;
      })
      .filter((entry): entry is string => entry !== null);

    expect(violations).toEqual([]);
  });
});
