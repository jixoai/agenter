import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createBundlePackageSpecs } from "./build-bundles";
import { bundlePublishOrder } from "./publish-bundles";

const repoRoot = resolve(import.meta.dir, "../..");

const readRepoFile = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), "utf8");

describe("Feature: release bundle contract", () => {
  test("Scenario: Given release bundles are generated When inspecting the bundle specs Then only the public package atoms are publishable", () => {
    const specs = createBundlePackageSpecs();

    expect(specs.map((spec) => spec.bundlePackageDir)).toEqual([
      "bundle/agenter",
      "bundle/agenter-ext-shell",
      "bundle/agenter-ext-studio",
      "bundle/@jixo/ghostty-native",
    ]);
    expect(bundlePublishOrder).toEqual([
      "bundle/@jixo/ghostty-native",
      "bundle/agenter-ext-shell",
      "bundle/agenter-ext-studio",
      "bundle/agenter",
    ]);
  });

  test("Scenario: Given bundled bins need package-local assets When inspecting release scripts Then wrapper bins own AGENTER_BUNDLED_ASSETS_ROOT", () => {
    const specs = createBundlePackageSpecs();
    const assetOwners = specs
      .filter((spec) => spec.bundledAssetsRoot)
      .map((spec) => spec.bundlePackageDir);
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");

    expect(assetOwners).toEqual(["bundle/agenter", "bundle/agenter-ext-studio"]);
    expect(buildScript).toContain("[name, `bin/${name}.js`]");
    expect(buildScript).toContain("process.env.AGENTER_BUNDLED_ASSETS_ROOT = resolve(packageRoot, \"assets\")");
    expect(buildScript).toContain("libprofile_resvg_bridge.${suffix}");
    expect(buildScript).toContain("await chmod(binAbsolutePath, 0o755)");
    expect(buildScript).not.toContain('from: "packages/auth-service/native/resvg_bridge/target/release",');
  });

  test("Scenario: Given the npm CLI bundle starts daemon dependencies When inspecting the source bin Then reflect metadata is loaded before CLI imports", () => {
    const agenterBin = readRepoFile("packages/agenter/src/bin/agenter.ts");
    const cliBin = readRepoFile("packages/cli/src/bin/agenter.ts");
    const sourcePkg = JSON.parse(readRepoFile("packages/agenter/package.json")) as {
      dependencies?: Record<string, string>;
    };
    const cliPkg = JSON.parse(readRepoFile("packages/cli/package.json")) as {
      dependencies?: Record<string, string>;
    };

    expect(agenterBin).toMatch(/import "reflect-metadata";\s*import \{ runCli \} from "@agenter\/cli";/u);
    expect(cliBin).toMatch(/import "reflect-metadata";\s*import \{ runCli \} from "\.\.\/run-cli";/u);
    expect(sourcePkg.dependencies?.["reflect-metadata"]).toBe("^0.2.2");
    expect(cliPkg.dependencies?.["reflect-metadata"]).toBe("^0.2.2");
  });

  test("Scenario: Given npm daemon start forks a background child When inspecting the CLI source Then it reuses the current executable entrypoint", () => {
    const cliSource = readRepoFile("packages/cli/src/run-cli.ts");

    expect(cliSource).toContain("const resolveCurrentCliEntrypointArgv = (): string[] => {");
    expect(cliSource).toContain('const entrypoint = process.argv[1];');
    expect(cliSource).toContain('return ["run", resolveCliEntryPath()];');
    expect(cliSource).toContain('const argv = [...resolveCurrentCliEntrypointArgv(), "daemon", "start"');
    expect(cliSource).not.toContain('const argv = ["run", resolveCliEntryPath(), "daemon", "start"');
  });

  test("Scenario: Given cli-shell uses OpenTUI native packages When bundling the JS entry Then platform native packages stay install-time dependencies", () => {
    const shellSpec = createBundlePackageSpecs().find((spec) => spec.bundlePackageDir === "bundle/agenter-ext-shell");

    expect(shellSpec?.dependencies).toBeUndefined();
    expect(shellSpec?.optionalDependencies?.["@opentui/core-darwin-arm64"]).toBe("0.2.15");
    expect(shellSpec?.optionalDependencies?.["@opentui/core-linux-x64"]).toBe("0.2.15");
    expect(shellSpec?.optionalDependencies?.["@opentui/core-win32-x64"]).toBe("0.2.15");
  });

  test("Scenario: Given release CI starts from a clean checkout When building bundles Then generated prompt and native assets are built before copy", () => {
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");

    expect(buildScript).toContain('await run(["bun", "run", "build:i18n"])');
    expect(buildScript).toContain("https://ziglang.org/download/");
    expect(buildScript).toContain("{ ZIG_BIN: zigBin }");
    expect(buildScript).toContain('"@jixo/ghostty-native", "build:ghostty-native"');
  });

  test("Scenario: Given npm provenance validates repository identity When writing bundle package manifests Then every publishable atom points at the agenter repository", () => {
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");

    expect(buildScript).toContain('const releaseRepositoryUrl = "git+https://github.com/jixoai/agenter.git"');
    expect(buildScript).toContain("repository: {");
    expect(buildScript).toContain("url: releaseRepositoryUrl");
    expect(buildScript).toContain("directory: input.sourcePackageDir");
  });

  test("Scenario: Given ghostty-native is published under Jixo When inspecting source and release specs Then the native artifact and package name stay explicit", () => {
    const ghosttyPkg = JSON.parse(readRepoFile("packages/ghostty-native/package.json")) as {
      files?: string[];
      name?: string;
    };
    const termlessCorePkg = JSON.parse(readRepoFile("packages/termless-core/package.json")) as {
      dependencies?: Record<string, string>;
    };
    const specs = createBundlePackageSpecs();
    const ghosttySpec = specs.find((spec) => spec.bundlePackageDir === "bundle/@jixo/ghostty-native");

    expect(ghosttyPkg.name).toBe("@jixo/ghostty-native");
    expect(ghosttyPkg.files).toContain("termless-ghostty-native.node");
    expect(termlessCorePkg.dependencies?.["@jixo/ghostty-native"]).toBe("workspace:*");
    expect(termlessCorePkg.dependencies?.["@termless/ghostty-native"]).toBeUndefined();
    expect(ghosttySpec?.assets?.map((asset) => asset.to)).toContain("termless-ghostty-native.node");
    expect(ghosttySpec?.assets?.map((asset) => asset.to)).toContain("native/zig-out/lib/termless-ghostty-native.node");
  });

  test("Scenario: Given GitHub trusted publishing is configured When inspecting the publish path Then npm provenance is mandatory and stale versions are skipped", () => {
    const publishScript = readRepoFile("scripts/release/publish-bundles.ts");
    const workflow = readRepoFile(".github/workflows/release.yml");

    expect(publishScript).toContain("\"--provenance\"");
    expect(publishScript).toContain("isPackageVersionPublished");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("environment: npm-release");
    expect(workflow).toContain("actions/setup-node@v4");
    expect(workflow).toContain('node-version: "24"');
    expect(workflow).toContain('registry-url: "https://registry.npmjs.org"');
    expect(workflow).toContain("npm --version");
    expect(workflow).toContain("changesets/action@v1");
    expect(workflow).toContain("publish: bun run release-packages");
  });
});
