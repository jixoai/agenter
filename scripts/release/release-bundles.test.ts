import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createBundlePackageSpecs } from "./build-bundles";
import { bundlePublishOrder } from "./publish-bundles";
import {
  createReleaseBundlePackageSpecs,
  releaseBundlePublishOrder,
  releasePublishablePackageJsonPaths,
  releaseRepositoryUrl,
  releaseToolchain,
} from "./release-manifest";

const repoRoot = resolve(import.meta.dir, "../..");

const readRepoFile = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), "utf8");

describe("Feature: release bundle contract", () => {
  test("Scenario: Given release bundles are generated When inspecting the bundle specs Then only the public package atoms are publishable", () => {
    const specs = createBundlePackageSpecs();

    expect(specs).toEqual(createReleaseBundlePackageSpecs());
    expect(specs.map((spec) => spec.bundlePackageDir)).toEqual([
      "bundle/agenter",
      "bundle/agenter-app-shell",
      "bundle/agenter-app-studio",
      "bundle/@jixo/ghostty-native",
    ]);
    expect(bundlePublishOrder).toEqual([
      "bundle/@jixo/ghostty-native",
      "bundle/agenter-app-shell",
      "bundle/agenter-app-studio",
      "bundle/agenter",
    ]);
    expect(bundlePublishOrder).toBe(releaseBundlePublishOrder);
  });

  test("Scenario: Given bundled bins need package-local assets When inspecting release scripts Then wrapper bins own AGENTER_BUNDLED_ASSETS_ROOT", () => {
    const specs = createBundlePackageSpecs();
    const assetOwners = specs.filter((spec) => spec.bundledAssetsRoot).map((spec) => spec.bundlePackageDir);
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");
    const manifest = readRepoFile("scripts/release/release-manifest.ts");

    expect(assetOwners).toEqual(["bundle/agenter", "bundle/agenter-app-studio"]);
    expect(buildScript).toContain("[name, `bin/${name}.js`]");
    expect(buildScript).toContain('process.env.AGENTER_BUNDLED_ASSETS_ROOT = resolve(packageRoot, "assets")');
    expect(manifest).toContain("libprofile_resvg_bridge.${releaseNativeLibrarySuffix}");
    expect(buildScript).toContain("await chmod(binAbsolutePath, 0o755)");
    expect(manifest).not.toContain('from: "packages/auth-service/native/resvg_bridge/target/release",');
  });

  test("Scenario: Given reactive-fs depends on a native watcher When bundling agenter Then parcel watcher stays external and install-time metadata is explicit", () => {
    const agenterSpec = createBundlePackageSpecs().find((spec) => spec.bundlePackageDir === "bundle/agenter");
    const reactiveFsPkg = JSON.parse(readRepoFile("packages/reactive-fs/package.json")) as {
      dependencies?: Record<string, string>;
    };
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");

    expect(reactiveFsPkg.dependencies?.["@parcel/watcher"]).toBe("^2.5.1");
    expect(agenterSpec?.dependencies?.["@parcel/watcher"]).toBe("^2.5.1");
    expect(agenterSpec?.external).toContain("@parcel/watcher");
    expect(buildScript).toContain('...(input.external ?? []).flatMap((name) => ["--external", name])');
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
    expect(cliSource).toContain("const entrypoint = process.argv[1];");
    expect(cliSource).toContain('return ["run", resolveCliEntryPath()];');
    expect(cliSource).toMatch(/const argv = \[\s*\.\.\.resolveCurrentCliEntrypointArgv\(\),\s*"daemon",\s*"start",/u);
    expect(cliSource).not.toContain('const argv = ["run", resolveCliEntryPath(), "daemon", "start"');
  });

  test("Scenario: Given npm daemon start runs after a cold install When inspecting the CLI source Then startup health probes stay short and the cold-start window is explicit", () => {
    const cliSource = readRepoFile("packages/cli/src/run-cli.ts");

    expect(cliSource).toContain("const HEALTH_REQUEST_TIMEOUT_MS = 5_000;");
    expect(cliSource).toContain("const MANAGED_DAEMON_START_TIMEOUT_MS = 60_000;");
    expect(cliSource).toContain("const MANAGED_DAEMON_START_HEALTH_REQUEST_TIMEOUT_MS = 1_000;");
    expect(cliSource).toContain("await isDaemonAlive(authority, MANAGED_DAEMON_START_HEALTH_REQUEST_TIMEOUT_MS)");
    expect(cliSource).not.toContain("const MANAGED_DAEMON_START_TIMEOUT_MS = 15_000;");
  });

  test("Scenario: Given Shell uses OpenTUI native packages When bundling the JS entry Then platform native packages stay install-time dependencies", () => {
    const shellSpec = createBundlePackageSpecs().find((spec) => spec.bundlePackageDir === "bundle/agenter-app-shell");

    expect(shellSpec?.dependencies).toBeUndefined();
    expect(shellSpec?.optionalDependencies?.["@opentui/core-darwin-arm64"]).toBe("0.3.0");
    expect(shellSpec?.optionalDependencies?.["@opentui/core-linux-x64"]).toBe("0.3.0");
    expect(shellSpec?.optionalDependencies?.["@opentui/core-win32-x64"]).toBe("0.3.0");
  });

  test("Scenario: Given app packages are published When inspecting release metadata Then host compatibility is app-owned peer data", () => {
    const shellPkg = JSON.parse(readRepoFile("apps/shell/package.json")) as {
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const studioPkg = JSON.parse(readRepoFile("apps/studio/package.json")) as {
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");

    expect(shellPkg.peerDependencies?.agenter).toBe(">=0.0.8 <0.1.0");
    expect(studioPkg.peerDependencies?.agenter).toBe(">=0.0.7 <0.1.0");
    expect(shellPkg.devDependencies?.agenter).toBe("workspace:*");
    expect(studioPkg.devDependencies?.agenter).toBe("workspace:*");
    expect(buildScript).toContain("peerDependencies: input.peerDependencies ?? sourcePkg.peerDependencies");
  });

  test("Scenario: Given release CI starts from a clean checkout When building bundles Then generated prompt and native assets are built before copy", () => {
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["build:i18n"]).toBe(
      "bun run --cwd packages/i18n-en build && bun run --cwd packages/i18n-zh-Hans build",
    );
    expect(packageJson.scripts?.["build:i18n"]).not.toContain("--filter '@agenter/i18n-*'");
    expect(buildScript).toContain('await run(["bun", "run", "build:i18n"])');
    expect(buildScript).toContain("https://ziglang.org/download/");
    expect(buildScript).toContain("{ ZIG_BIN: zigBin }");
    expect(buildScript).toContain('"@jixo/ghostty-native", "build:ghostty-native"');
  });

  test("Scenario: Given npm provenance validates repository identity When writing bundle package manifests Then every publishable atom points at the agenter repository", () => {
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");
    const manifest = readRepoFile("scripts/release/release-manifest.ts");

    expect(releaseRepositoryUrl).toBe("git+https://github.com/jixoai/agenter.git");
    expect(manifest).toContain('releaseRepositoryUrl = "git+https://github.com/jixoai/agenter.git"');
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
    expect(ghosttyPkg.files).not.toContain("build");
    expect(ghosttyPkg.files).not.toContain("native");
    expect(ghosttyPkg.files).not.toContain("vendor");
    expect(termlessCorePkg.dependencies?.["@jixo/ghostty-native"]).toBe("workspace:*");
    expect(termlessCorePkg.dependencies?.["@termless/ghostty-native"]).toBeUndefined();
    expect(ghosttySpec?.assets?.map((asset) => asset.to)).toContain("termless-ghostty-native.node");
    expect(ghosttySpec?.assets?.map((asset) => asset.to)).not.toContain("build");
    expect(ghosttySpec?.assets?.map((asset) => asset.to)).not.toContain(
      "native/zig-out/lib/termless-ghostty-native.node",
    );
  });

  test("Scenario: Given GitHub trusted publishing is configured When inspecting the publish path Then npm provenance is mandatory and stale versions are skipped", () => {
    const publishScript = readRepoFile("scripts/release/publish-bundles.ts");
    const trustedPublishScript = readRepoFile("scripts/npm/configure-trusted-publish.ts");
    const workflow = readRepoFile(".github/workflows/release.yml");
    const changesetReadme = readRepoFile(".changeset/README.md");
    const gitignore = readRepoFile(".gitignore");
    const spec = readRepoFile("SPEC.md");
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      packageManager?: string;
      scripts?: Record<string, string>;
    };

    expect(publishScript).toContain('"--provenance"');
    expect(publishScript).toContain("isPackageVersionPublished");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("environment: npm-release");
    expect(workflow).toContain("actions/checkout@v5");
    expect(workflow).toContain("actions/setup-node@v5");
    expect(workflow).toContain('node-version: "24"');
    expect(workflow).toContain(`bun-version: "${releaseToolchain.bunVersion}"`);
    expect(workflow).not.toContain("bun-version: latest");
    expect(workflow).toContain('registry-url: "https://registry.npmjs.org"');
    expect(workflow).toContain("npm --version");
    expect(workflow).toContain("bun run release:preflight --skip-install");
    expect(workflow).toContain("changesets/action@v1");
    expect(workflow).toContain("publish: bun run release-packages");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("steps.changesets.outputs.published");
    expect(packageJson.scripts?.["release-packages"]).toBe(
      "bun run release:build-bundles && bun run release:publish-bundles && bun run release:verify-published",
    );
    expect(trustedPublishScript).toContain('repo: "jixoai/agenter"');
    expect(trustedPublishScript).toContain("releasePublishablePackageJsonPaths");
    expect(trustedPublishScript).toContain('mkdtemp(join(tmpdir(), "agenter-npm-"))');
    expect(trustedPublishScript).toContain("--file");
    expect(trustedPublishScript).toContain("--allow-publish");
    expect(trustedPublishScript).toContain("--allow-stage-publish");
    expect(trustedPublishScript).not.toContain("jixoai/opentray");
    expect(trustedPublishScript.indexOf("if (options.dryRun)")).toBeLessThan(
      trustedPublishScript.indexOf("const auth = await createNpmAuth(options)"),
    );
    expect(releasePublishablePackageJsonPaths).toEqual([
      "packages/agenter/package.json",
      "apps/shell/package.json",
      "apps/studio/package.json",
      "packages/ghostty-native/package.json",
    ]);
    expect(packageJson.packageManager).toBe(`bun@${releaseToolchain.bunVersion}`);
    expect(packageJson.scripts?.["release:preflight"]).toBe("bun run scripts/release/preflight.ts");
    expect(packageJson.scripts?.["release:verify-published"]).toBe("bun run scripts/release/verify-published.ts");
    expect(packageJson.scripts?.["trusted-publish:check"]).toBe(
      "bun run scripts/npm/configure-trusted-publish.ts --check",
    );
    expect(packageJson.scripts?.["trusted-publish:configure"]).toBe("bun run scripts/npm/configure-trusted-publish.ts");
    expect(packageJson.scripts?.["trusted-publish:dry-run"]).toBe(
      "bun run scripts/npm/configure-trusted-publish.ts --dry-run",
    );
    expect(changesetReadme).toContain("GitHub-owned");
    expect(changesetReadme).toContain("Do not add a long-lived `NPM_TOKEN` secret to CI");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".npmrc");
    expect(spec).toContain("npm release path 固定为 changesets + GitHub Actions trusted publishing");
    expect(spec).toContain("releasePublishablePackageJsonPaths");
  });

  test("Scenario: Given release reliability scripts run When inspecting preflight and published verification Then they reuse release manifest without extension vocabulary checks", () => {
    const preflightScript = readRepoFile("scripts/release/preflight.ts");
    const verifyScript = readRepoFile("scripts/release/verify-published.ts");

    expect(preflightScript).toContain("releaseToolchain");
    expect(preflightScript).toContain('["bun", "install", "--frozen-lockfile"]');
    expect(preflightScript).toContain("release-bundles.test.ts");
    expect(preflightScript).toContain("release:build-bundles");
    expect(preflightScript).not.toContain("audit-app-platform-vocabulary");
    expect(verifyScript).toContain("releaseBundlePublishOrder");
    expect(verifyScript).toContain("npm");
    expect(verifyScript).toContain("peerDependencies");
    expect(verifyScript).toContain("optionalDependencies");
  });
});
