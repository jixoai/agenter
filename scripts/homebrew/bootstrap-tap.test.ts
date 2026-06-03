import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bootstrapHomebrewTap, parseArgs, syncProjectionIntoCheckout } from "./bootstrap-tap";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-homebrew-bootstrap-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

describe("Feature: homebrew tap bootstrap automation", () => {
  test("Scenario: Given a projection directory is prepared When checkout sync runs Then the tap repo working tree is replaced from the main-repo projection truth", async () => {
    const projectionDir = createTempDir();
    const checkoutDir = createTempDir();

    mkdirSync(join(checkoutDir, ".git"));
    writeFileSync(join(checkoutDir, "old.txt"), "stale");
    mkdirSync(join(projectionDir, "Formula"), { recursive: true });
    writeFileSync(join(projectionDir, "Formula", "agenter.rb"), "class Agenter < Formula\nend\n");

    await syncProjectionIntoCheckout(projectionDir, checkoutDir);

    expect(() => readFileSync(join(checkoutDir, "old.txt"), "utf8")).toThrow();
    expect(readFileSync(join(checkoutDir, "Formula", "agenter.rb"), "utf8")).toContain("class Agenter");
  });

  test("Scenario: Given the tap repo does not exist When bootstrap runs in dry-run mode Then the gh create path is made explicit without mutating GitHub", async () => {
    const projectionDir = createTempDir();
    writeFileSync(join(projectionDir, "agenter.rb"), "class Agenter < Formula\nend\n");
    const commands: string[] = [];

    const report = await bootstrapHomebrewTap({
      ...parseArgs(["--projection-dir", projectionDir, "--dry-run"]),
      runner: async (cmd) => {
        commands.push(cmd.join(" "));
        if (cmd[0] === "gh" && cmd[1] === "repo" && cmd[2] === "view") {
          return { exitCode: 1, stderr: "GraphQL: Could not resolve to a Repository", stdout: "" };
        }
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      workspace: createTempDir(),
    });

    expect(report.repoExists).toBe(false);
    expect(report.createdRepo).toBe(false);
    expect(report.stages).toContain("would create repo: jixoai/homebrew-agenter");
    expect(commands).toEqual(["gh repo view jixoai/homebrew-agenter --json nameWithOwner"]);
  });

  test("Scenario: Given the tap repo exists When bootstrap runs with a changed projection Then it clones, commits, and pushes the generated projection", async () => {
    const projectionDir = createTempDir();
    writeFileSync(join(projectionDir, "agenter.rb"), "class Agenter < Formula\nend\n");
    const commands: string[] = [];

    const report = await bootstrapHomebrewTap({
      ...parseArgs(["--projection-dir", projectionDir, "--repo", "jixoai/homebrew-agenter"]),
      runner: async (cmd) => {
        commands.push(cmd.join(" "));
        if (cmd[0] === "gh" && cmd[1] === "repo" && cmd[2] === "view") {
          return { exitCode: 0, stderr: "", stdout: '{"nameWithOwner":"jixoai/homebrew-agenter"}' };
        }
        if (cmd[0] === "gh" && cmd[1] === "repo" && cmd[2] === "clone") {
          const checkoutDir = cmd[4];
          mkdirSync(checkoutDir, { recursive: true });
          mkdirSync(join(checkoutDir, ".git"));
          return { exitCode: 0, stderr: "", stdout: "" };
        }
        if (cmd[0] === "git" && cmd[1] === "status") {
          return { exitCode: 0, stderr: "", stdout: " M agenter.rb\n" };
        }
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      workspace: createTempDir(),
    });

    expect(report.repoExists).toBe(true);
    expect(report.changed).toBe(true);
    expect(commands[0]).toBe("gh repo view jixoai/homebrew-agenter --json nameWithOwner");
    expect(commands[1]).toMatch(/^gh repo clone jixoai\/homebrew-agenter /u);
    expect(commands.slice(2)).toEqual([
      "git status --short",
      "git add -A",
      "git commit -m Update Agenter Homebrew projection",
      "git push origin HEAD:main",
    ]);
  });
});
