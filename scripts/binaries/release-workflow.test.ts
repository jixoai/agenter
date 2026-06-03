import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../..");
const releaseWorkflow = (): string => readFileSync(resolve(repoRoot, ".github/workflows/release.yml"), "utf8");

describe("Feature: ghostty-native release workflow", () => {
  test("Scenario: Given multi-platform ghostty packages When the release workflow is inspected Then native artifacts are built on each target and staged back into npm packages", () => {
    const workflow = releaseWorkflow();
    const releaseJob = workflow.slice(workflow.indexOf("  release:"));

    expect(workflow).toContain("name: Native artifacts (${{ matrix.target }})");
    expect(workflow).toContain("darwin-arm64");
    expect(workflow).toContain("darwin-x64");
    expect(workflow).toContain("linux-arm64");
    expect(workflow).toContain("linux-x64");
    expect(workflow).toContain("windows-arm64");
    expect(workflow).toContain("windows-x64");
    expect(workflow).toContain('uses: actions/upload-artifact@v4');
    expect(releaseJob).toContain("Download native artifacts");
    expect(releaseJob).toContain("Stage ghostty-native artifacts into npm packages");
    expect(releaseJob).toContain('bun run scripts/binaries/stage-local.ts');
    expect(releaseJob).toContain('--source "native-artifacts/ghostty-native-${target}/termless-ghostty-native.node"');
    expect(releaseJob).toContain("Validate publish package contents");
    expect(releaseJob).toContain("packages/ghostty-native-darwin-arm64");
    expect(releaseJob).toContain("packages/ghostty-native-win32-x64-msvc");
    expect(releaseJob).toContain("git push origin --tags");
  });
});
