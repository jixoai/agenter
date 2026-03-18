import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { WorkspacePathSearchIndex } from "../src/workspace-path-search";

const createTempWorkspace = (): string => mkdtempSync(join(tmpdir(), "agenter-workspace-path-search-"));

const git = (cwd: string, args: string[]): void => {
  execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "ignore", "ignore"],
  });
};

describe("Feature: workspace path search", () => {
  test("Scenario: Given a git workspace with ignored files When indexing @ paths Then ignored files stay out of the fuzzy index", () => {
    const workspace = createTempWorkspace();
    try {
      mkdirSync(join(workspace, "src"), { recursive: true });
      mkdirSync(join(workspace, "ignored"), { recursive: true });
      mkdirSync(join(workspace, "vendor", "react"), { recursive: true });
      mkdirSync(join(workspace, "node_modules"), { recursive: true });
      writeFileSync(join(workspace, ".gitignore"), "ignored\nnode_modules\n", "utf8");
      writeFileSync(join(workspace, "README.md"), "# demo\n", "utf8");
      writeFileSync(join(workspace, "node_tools.md"), "# tracked helper\n", "utf8");
      writeFileSync(join(workspace, "src", "index.ts"), "export const demo = true;\n", "utf8");
      writeFileSync(join(workspace, "ignored", "secret.ts"), "export const secret = true;\n", "utf8");
      writeFileSync(join(workspace, "vendor", "react", "package.json"), '{"name":"react"}\n', "utf8");
      symlinkSync(join(workspace, "vendor", "react"), join(workspace, "node_modules", "react"), "dir");

      git(workspace, ["init", "-q"]);
      git(workspace, ["add", ".gitignore", "README.md", "node_tools.md", "src/index.ts"]);

      const index = new WorkspacePathSearchIndex();
      const rootResults = index.search({ cwd: workspace, query: "@", limit: 10 });
      const ignoredResults = index.search({ cwd: workspace, query: "@secret", limit: 10 });
      const directIgnoredDirectoryResults = index.search({ cwd: workspace, query: "@node_", limit: 10 });
      const directIgnoredChildResults = index.search({ cwd: workspace, query: "@node_modules/re", limit: 10 });
      const directIgnoredFileResults = index.search({ cwd: workspace, query: "@node_modules/react/pa", limit: 10 });

      expect(rootResults).toEqual(
        expect.arrayContaining([
          {
            label: "src/",
            path: "src/",
            isDirectory: true,
          },
          {
            label: "README.md",
            path: "README.md",
            isDirectory: false,
          },
        ]),
      );
      expect(rootResults.some((item) => item.path.startsWith("ignored"))).toBe(false);
      expect(ignoredResults).toEqual([]);
      expect(directIgnoredDirectoryResults[0]).toEqual({
        label: "node_modules/",
        path: "node_modules/",
        isDirectory: true,
        ignored: true,
      });
      expect(directIgnoredDirectoryResults).toEqual(
        expect.arrayContaining([
          {
            label: "node_tools.md",
            path: "node_tools.md",
            isDirectory: false,
          },
        ]),
      );
      expect(directIgnoredChildResults[0]).toEqual({
        label: "node_modules/react/",
        path: "node_modules/react/",
        isDirectory: true,
        ignored: true,
      });
      expect(directIgnoredFileResults[0]).toEqual({
        label: "node_modules/react/package.json",
        path: "node_modules/react/package.json",
        isDirectory: false,
        ignored: true,
      });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
