import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  agenterCliTargets,
  createAgenterCliArchivePath,
  agenterCliPlatformPackageJsonPaths,
  normalizeAgenterCliArch,
  normalizeAgenterCliPackageLibc,
  normalizeAgenterCliPackageOs,
  resolveAgenterCliPackageTarget,
} from "./agenter-cli-artifacts";

const repoRoot = resolve(import.meta.dir, "../..");

describe("Feature: agenter native CLI artifact topology", () => {
  test("Scenario: Given the phase-1 native CLI matrix When targets are enumerated Then every supported host maps to one explicit package atom", () => {
    expect(agenterCliTargets).toHaveLength(8);
    expect(agenterCliTargets.map((target) => target.packageName)).toEqual([
      "@agenter/cli-darwin-arm64",
      "@agenter/cli-darwin-x64",
      "@agenter/cli-linux-arm64-gnu",
      "@agenter/cli-linux-arm64-musl",
      "@agenter/cli-linux-x64-gnu",
      "@agenter/cli-linux-x64-musl",
      "@agenter/cli-win32-arm64",
      "@agenter/cli-win32-x64",
    ]);
    expect(agenterCliTargets.map((target) => target.bunTarget)).toEqual([
      "bun-darwin-arm64",
      "bun-darwin-x64",
      "bun-linux-arm64",
      "bun-linux-arm64-musl",
      "bun-linux-x64",
      "bun-linux-x64-musl",
      "bun-windows-arm64",
      "bun-windows-x64",
    ]);
  });

  test("Scenario: Given one target is inspected When naming metadata is derived Then package and archive truth stay aligned", () => {
    const linuxMusl = resolveAgenterCliPackageTarget("linux", "x64", "musl");
    const windows = resolveAgenterCliPackageTarget("win32", "arm64");

    expect(linuxMusl.targetId).toBe("linux-x64-musl");
    expect(linuxMusl.packageDir).toBe("packages/agenter-cli-linux-x64-musl");
    expect(linuxMusl.archiveStem).toBe("agenter-linux-x64-musl");
    expect(linuxMusl.archiveFormat).toBe("tar.gz");
    expect(linuxMusl.archiveFileName).toBe("agenter-linux-x64-musl.tar.gz");
    expect(linuxMusl.archiveBinaryPath).toBe("agenter");
    expect(linuxMusl.checksumFileName).toBe("agenter-linux-x64-musl.sha256");
    expect(linuxMusl.packageBinaryPath).toBe("bin/agenter");
    expect(linuxMusl.artifactPath).toBe("packages/agenter-cli-linux-x64-musl/bin/agenter");
    expect(createAgenterCliArchivePath("/release", linuxMusl)).toBe("/release/agenter-linux-x64-musl.tar.gz");

    expect(windows.targetId).toBe("win32-arm64");
    expect(windows.archiveStem).toBe("agenter-win32-arm64");
    expect(windows.archiveFormat).toBe("zip");
    expect(windows.archiveFileName).toBe("agenter-win32-arm64.zip");
    expect(windows.archiveBinaryPath).toBe("agenter.exe");
    expect(windows.packageBinaryPath).toBe("bin/agenter.exe");
    expect(windows.artifactPath).toBe("packages/agenter-cli-win32-arm64/bin/agenter.exe");
    expect(windows.homebrewTargetId).toBe("win32-arm64");
  });

  test("Scenario: Given target normalization receives unsupported or ambiguous input When resolution runs Then the error is explicit", () => {
    expect(() => normalizeAgenterCliPackageOs("freebsd")).toThrow("unsupported agenter CLI platform");
    expect(() => normalizeAgenterCliArch("riscv64")).toThrow("unsupported agenter CLI architecture");
    expect(() => normalizeAgenterCliPackageLibc("msvc")).toThrow("unsupported agenter CLI libc");
    expect(() => resolveAgenterCliPackageTarget("linux", "x64")).toThrow(
      "linux agenter CLI target resolution requires explicit libc",
    );
  });

  test("Scenario: Given public platform packages are scaffolded When manifests are inspected Then each target keeps narrow host metadata", () => {
    for (const packageJsonPath of agenterCliPlatformPackageJsonPaths) {
      const pkg = JSON.parse(readFileSync(join(repoRoot, packageJsonPath), "utf8")) as {
        bin?: Record<string, string>;
        cpu?: string[];
        files?: string[];
        libc?: string[];
        name?: string;
        os?: string[];
      };
      expect(pkg.files).toEqual(["README.md", "bin"]);
      expect(pkg.bin).toBeUndefined();
      expect(pkg.name).toMatch(/^@agenter\/cli-/u);
      expect(pkg.os).toHaveLength(1);
      expect(pkg.cpu).toHaveLength(1);
      if (pkg.os[0] === "linux") {
        expect(pkg.libc === undefined || pkg.libc.length === 1).toBe(true);
      } else {
        expect(pkg.libc).toBeUndefined();
      }
    }
  });
});
