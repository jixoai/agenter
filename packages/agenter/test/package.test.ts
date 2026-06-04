import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { agenterCliTargets } from "../../../scripts/binaries/agenter-cli-artifacts";

const packageRoot = join(import.meta.dir, "..");
const require = createRequire(import.meta.url);

describe("Feature: agenter publish package", () => {
  test("Scenario: Given the public agenter package When inspecting its release metadata Then the package stays wrapper-first over explicit native platform packages", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      bin?: Record<string, string>;
      devDependencies?: Record<string, string>;
      files?: string[];
      engines?: Record<string, string>;
      name?: string;
      optionalDependencies?: Record<string, string>;
      publishConfig?: Record<string, string>;
      private?: boolean;
      repository?: { type?: string; url?: string };
      scripts?: Record<string, string>;
    };
    const nativePlatform = require(join(packageRoot, "native-platform.cjs")) as {
      PLATFORMS: Record<string, { bin: string; pkg: string }>;
    };
    const placeholder = readFileSync(join(packageRoot, "bin", "agenter.exe"), "utf8");
    const wrapperSource = readFileSync(join(packageRoot, "cli-wrapper.cjs"), "utf8");
    const installSource = readFileSync(join(packageRoot, "install.cjs"), "utf8");
    const sourceEntry = readFileSync(join(packageRoot, "src", "bin", "agenter.ts"), "utf8");
    const expectedOptionalDependencies = Object.fromEntries(
      agenterCliTargets.map((target) => [target.packageName, "workspace:*"]),
    );

    expect(pkg.name).toBe("agenter");
    expect(pkg.private).toBeUndefined();
    expect(pkg.bin).toEqual({ agenter: "./bin/agenter.exe" });
    expect(pkg.repository).toEqual({ type: "git", url: "https://github.com/jixoai/agenter" });
    expect(pkg.files).toEqual([
      "CHANGELOG.md",
      "SPEC.md",
      "bin",
      "cli-wrapper.cjs",
      "install.cjs",
      "native-platform.cjs",
    ]);
    expect(pkg.publishConfig).toEqual({ access: "public" });
    expect(pkg.optionalDependencies).toEqual(expectedOptionalDependencies);
    expect(pkg.devDependencies?.["@agenter/cli"]).toBe("workspace:*");
    expect(pkg.scripts).toEqual({
      postinstall: "node ./install.cjs",
      test: "bun test",
      typecheck: "bunx tsc --noEmit",
    });
    expect(pkg.engines).toEqual({
      bun: ">=1.3.10",
      node: ">=18.0.0",
    });
    expect(Object.keys(nativePlatform.PLATFORMS).sort()).toEqual(
      agenterCliTargets.map((target) => target.targetId).sort(),
    );
    expect(
      Object.values(nativePlatform.PLATFORMS)
        .map((entry) => entry.pkg)
        .sort(),
    ).toEqual(agenterCliTargets.map((target) => target.packageName).sort());
    expect(placeholder).toContain("Error: agenter native binary not installed.");
    expect(placeholder).toContain("node node_modules/agenter/install.cjs");
    expect(placeholder).toContain("node node_modules/agenter/cli-wrapper.cjs");
    expect(wrapperSource).toContain("resolvePackageBinaryPath");
    expect(wrapperSource).toContain("spawnWrapperBinary");
    expect(installSource).toContain("placeBinary");
    expect(installSource).toContain("copyFileSync");
    expect(sourceEntry).toContain('from "@agenter/cli"');
  });
});
