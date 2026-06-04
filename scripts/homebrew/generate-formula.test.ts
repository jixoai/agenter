import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AgenterReleaseArchiveManifest } from "../release/agenter-release-archive-manifest";
import {
  generateAgenterFormula,
  parseArgs,
  renderAgenterFormula,
  type GenerateAgenterFormulaOptions,
} from "./generate-formula";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-homebrew-formula-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

const createManifest = (): AgenterReleaseArchiveManifest => ({
  releaseTag: "v0.0.10",
  version: "0.0.10",
  archives: [
    {
      archiveBinaryPath: "agenter",
      archiveFileName: "agenter-darwin-arm64.tar.gz",
      archiveSha256: "sha-darwin-arm64",
      archiveUrl: "https://example.invalid/agenter-darwin-arm64.tar.gz",
      homebrewBinaryPath: "agenter",
      packageName: "@agenter/cli-darwin-arm64",
      packageBinaryPath: "bin/agenter",
      targetId: "darwin-arm64",
    },
    {
      archiveBinaryPath: "agenter",
      archiveFileName: "agenter-darwin-x64.tar.gz",
      archiveSha256: "sha-darwin-x64",
      archiveUrl: "https://example.invalid/agenter-darwin-x64.tar.gz",
      homebrewBinaryPath: "agenter",
      packageName: "@agenter/cli-darwin-x64",
      packageBinaryPath: "bin/agenter",
      targetId: "darwin-x64",
    },
    {
      archiveBinaryPath: "agenter",
      archiveFileName: "agenter-linux-arm64-gnu.tar.gz",
      archiveSha256: "sha-linux-arm64",
      archiveUrl: "https://example.invalid/agenter-linux-arm64-gnu.tar.gz",
      homebrewBinaryPath: "agenter",
      packageName: "@agenter/cli-linux-arm64-gnu",
      packageBinaryPath: "bin/agenter",
      targetId: "linux-arm64-gnu",
    },
    {
      archiveBinaryPath: "agenter",
      archiveFileName: "agenter-linux-x64-gnu.tar.gz",
      archiveSha256: "sha-linux-x64",
      archiveUrl: "https://example.invalid/agenter-linux-x64-gnu.tar.gz",
      homebrewBinaryPath: "agenter",
      packageName: "@agenter/cli-linux-x64-gnu",
      packageBinaryPath: "bin/agenter",
      targetId: "linux-x64-gnu",
    },
  ],
});

describe("Feature: agenter Homebrew formula projection", () => {
  test("Scenario: Given a canonical release archive manifest When the formula is rendered Then Homebrew metadata maps to the same archive URLs and checksums", () => {
    const source = renderAgenterFormula(createManifest(), {
      formulaName: "agenter",
      homepage: "https://github.com/jixoai/agenter",
      license: "MIT",
    });

    expect(source).toContain("class Agenter < Formula");
    expect(source).toContain("on_macos do");
    expect(source).toContain("on_linux do");
    expect(source).toContain('url "https://example.invalid/agenter-darwin-arm64.tar.gz"');
    expect(source).toContain('sha256 "sha-linux-x64"');
    expect(source).toContain('bin.install "agenter" => "agenter"');
    expect(source).toContain("Windows and musl targets stay");
  });

  test("Scenario: Given manifest or output args are missing When CLI parsing runs Then the failure is explicit", () => {
    expect(() => parseArgs([])).toThrow("generate-formula requires --manifest");
    expect(() => parseArgs(["--manifest", "archive.json"])).toThrow("generate-formula requires --output-dir");
  });

  test("Scenario: Given a manifest file path and output dir When generation runs Then the formula lands in a tap-compatible Formula directory", async () => {
    const workspace = createTempDir();
    const manifestPath = join(workspace, "archive-manifest.json");
    const outputDir = join(workspace, "projection");
    writeFileSync(manifestPath, `${JSON.stringify(createManifest(), null, 2)}\n`);

    const formulaPath = await generateAgenterFormula({
      ...(parseArgs(["--manifest", manifestPath, "--output-dir", outputDir]) as GenerateAgenterFormulaOptions),
    });

    expect(formulaPath).toBe(join(outputDir, "Formula", "agenter.rb"));
    expect(readFileSync(formulaPath, "utf8")).toContain('license "MIT"');
  });
});
