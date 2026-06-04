import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  createBundlePackageSpecs,
  createHostOnlySmokeBundlePackageSpecs,
  parseBuildBundlesArgs,
} from "./build-bundles";
import { releasePackagePublishOrder } from "./publish-bundles";
import {
  createReleaseBundlePackageSpecs,
  releaseAgenterCliPlatformPackageJsonPaths,
  releaseBundlePublishOrder,
  releaseGhosttyNativePlatformPackageJsonPaths,
  releasePublishOrder,
  releasePublishablePackageJsonPaths,
  releaseRepositoryUrl,
  releaseToolchain,
} from "./release-manifest";

const repoRoot = resolve(import.meta.dir, "../..");

const readRepoFile = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), "utf8");
const readGitignoreLines = (): string[] => readRepoFile(".gitignore").split("\n");
const listDirNames = (relativePath: string): string[] => readdirSync(join(repoRoot, relativePath), { withFileTypes: true }).map((entry) => entry.name);

describe("Feature: release bundle contract", () => {
  test("Scenario: Given the retired tui backup remains in the repo When inspecting workspace and publish graphs Then tui-bak stays outside live package atoms", () => {
    const rootPackageJson = JSON.parse(readRepoFile("package.json")) as {
      workspaces?: string[];
    };
    const backupPkg = JSON.parse(readRepoFile("packages/tui-bak/package.json")) as {
      name?: string;
    };
    const pnpmWorkspace = readRepoFile("pnpm-workspace.yaml");

    expect(rootPackageJson.workspaces).not.toContain("packages/tui");
    expect(rootPackageJson.workspaces).not.toContain("packages/tui-bak");
    expect(pnpmWorkspace).not.toContain("packages/tui\n");
    expect(pnpmWorkspace).not.toContain("packages/tui-bak");
    expect(releasePublishablePackageJsonPaths).not.toContain("packages/tui-bak/package.json");
    expect(backupPkg.name).toBe("@agenter/tui-bak");
  });

  test("Scenario: Given backup trees stay in the repo When inspecting file truth rules Then generated Storybook outputs from *-bak and *-old stay outside git truth", () => {
    const gitignore = readGitignoreLines();
    const backupPackageDirs = listDirNames("packages").filter((name) => name.endsWith("-bak"));
    const backupAppDirs = listDirNames("apps").filter((name) => name.endsWith("-old"));

    expect(backupPackageDirs).toContain("tui-bak");
    expect(backupPackageDirs).toContain("webui-bak");
    expect(backupAppDirs).toContain("shell-old");
    expect(gitignore).toContain("packages/*-bak/storybook-static/");
    expect(gitignore).toContain("packages/*-bak/test/storybook/__screenshots__/");
    expect(gitignore).toContain("apps/*-old/storybook-static/");
    expect(gitignore).toContain("apps/*-old/test/storybook/__screenshots__/");
  });

  test("Scenario: Given operators need one durable install entrypoint When inspecting the repo root Then README documents npm, Homebrew, supported targets, and archive truth", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("npm install -g agenter");
    expect(readme).toContain("brew tap jixoai/agenter");
    expect(readme).toContain("GitHub release archives are the canonical binary truth");
    expect(readme).toContain("linux-x64-musl");
    expect(readme).toContain("agenter-release-archives.json");
  });

  test("Scenario: Given release bundles are generated When inspecting the bundle specs Then only the public package atoms are publishable", () => {
    const specs = createBundlePackageSpecs();

    expect(specs).toEqual(createReleaseBundlePackageSpecs());
    expect(specs.map((spec) => spec.bundlePackageDir)).toEqual([
      "bundle/agenter-app-shell",
      "bundle/agenter-app-studio",
      "bundle/@jixo/ghostty-native",
      "bundle/@jixo/ghostty-native-darwin-arm64",
      "bundle/@jixo/ghostty-native-darwin-x64",
      "bundle/@jixo/ghostty-native-linux-arm64-gnu",
      "bundle/@jixo/ghostty-native-linux-x64-gnu",
      "bundle/@jixo/ghostty-native-win32-arm64-msvc",
      "bundle/@jixo/ghostty-native-win32-x64-msvc",
    ]);
    expect(releaseBundlePublishOrder).toEqual([
      "bundle/@jixo/ghostty-native-darwin-arm64",
      "bundle/@jixo/ghostty-native-darwin-x64",
      "bundle/@jixo/ghostty-native-linux-arm64-gnu",
      "bundle/@jixo/ghostty-native-linux-x64-gnu",
      "bundle/@jixo/ghostty-native-win32-arm64-msvc",
      "bundle/@jixo/ghostty-native-win32-x64-msvc",
      "bundle/@jixo/ghostty-native",
      "bundle/agenter-app-shell",
      "bundle/agenter-app-studio",
    ]);
    expect(releasePackagePublishOrder).toEqual(releasePublishOrder);
    expect(releasePackagePublishOrder).toContain("packages/agenter-cli-darwin-arm64");
    expect(releasePackagePublishOrder).toContain("packages/agenter");
    expect(releasePackagePublishOrder).not.toContain("bundle/agenter");
  });

  test("Scenario: Given a maintainer wants local release validation When host-only smoke is selected Then only the current host platform bundle is staged under a separate smoke root", () => {
    const options = parseBuildBundlesArgs(["--host-only-smoke"]);
    const specs = createHostOnlySmokeBundlePackageSpecs("darwin", "arm64");
    const bundleDirs = specs.map((spec) => spec.bundlePackageDir);
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");

    expect(options.mode).toBe("host-only-smoke");
    expect(packageJson.scripts?.["release:build-bundles:host-smoke"]).toBe(
      "bun run scripts/release/build-bundles.ts --host-only-smoke",
    );
    expect(bundleDirs).toEqual([
      "bundle-host-smoke/agenter-app-shell",
      "bundle-host-smoke/agenter-app-studio",
      "bundle-host-smoke/@jixo/ghostty-native",
      "bundle-host-smoke/@jixo/ghostty-native-darwin-arm64",
    ]);
    expect(bundleDirs).not.toContain("bundle-host-smoke/@jixo/ghostty-native-darwin-x64");
    expect(bundleDirs).not.toContain("bundle-host-smoke/@jixo/ghostty-native-linux-x64-gnu");
    expect(buildScript).toContain('"host-only-smoke": "bundle-host-smoke"');
    expect(buildScript).toContain('bundlePackageDir: bundleDirForMode(spec.bundlePackageDir, "host-only-smoke")');
    expect(buildScript).toContain("host-only-smoke.json");
    expect(buildScript).toContain("Host-only smoke bundles written to ./bundle-host-smoke");
  });

  test("Scenario: Given bundled bins need package-local assets When inspecting release scripts Then wrapper bins own AGENTER_BUNDLED_ASSETS_ROOT", () => {
    const specs = createBundlePackageSpecs();
    const assetOwners = specs.filter((spec) => spec.bundledAssetsRoot).map((spec) => spec.bundlePackageDir);
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");
    const manifest = readRepoFile("scripts/release/release-manifest.ts");

    expect(assetOwners).toEqual(["bundle/agenter-app-studio"]);
    expect(buildScript).toContain("[name, `bin/${name}.js`]");
    expect(buildScript).toContain('process.env.AGENTER_BUNDLED_ASSETS_ROOT = resolve(packageRoot, "assets")');
    expect(manifest).not.toContain("libprofile_resvg_bridge");
    expect(buildScript).toContain("await chmod(binAbsolutePath, 0o755)");
    expect(buildScript).not.toContain('"@agenter/auth-service", "build:native"');
  });

  test("Scenario: Given agenter shifted to wrapper-plus-platform binaries When inspecting release metadata Then no JS bundle pretends to be the public CLI runtime", () => {
    const manifest = readRepoFile("scripts/release/release-manifest.ts");
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(createBundlePackageSpecs().find((spec) => spec.bundlePackageDir === "bundle/agenter")).toBeUndefined();
    expect(releasePackagePublishOrder).toContain("packages/agenter");
    expect(releasePackagePublishOrder).toContain("packages/agenter-cli-win32-x64");
    expect(packageJson.scripts?.["release:build-native-cli-archives"]).toBe(
      "bun run scripts/release/build-agenter-release-archives.ts --input-dir native-artifacts --output-dir release-archives/agenter-cli",
    );
    expect(packageJson.scripts?.["release:stage-native-cli-packages-from-archives"]).toBe(
      "bun run scripts/release/stage-agenter-cli-packages-from-release-archives.ts --manifest release-archives/agenter-cli/agenter-release-archives.json",
    );
    expect(packageJson.scripts?.["release:prepare-native-cli-packages"]).toBe(
      "bun run release:build-native-cli:all-targets && bun run release:build-native-cli-archives && bun run release:stage-native-cli-packages-from-archives && bun run release:verify-native-cli-packages",
    );
    expect(packageJson.scripts?.["release:prepare-packages"]).toBe(
      "bun run release:build-bundles && bun run release:prepare-native-cli-packages",
    );
    expect(manifest).not.toContain('"@duckdb/node-api"');
  });

  test("Scenario: Given the public agenter package is wrapper-first When inspecting wrapper and launcher sources Then reflect metadata stays with the internal launcher path", () => {
    const agenterBin = readRepoFile("packages/agenter/src/bin/agenter.ts");
    const wrapperSource = readRepoFile("packages/agenter/cli-wrapper.cjs");
    const installSource = readRepoFile("packages/agenter/install.cjs");
    const cliBin = readRepoFile("packages/cli/src/bin/agenter.ts");
    const sourcePkg = JSON.parse(readRepoFile("packages/agenter/package.json")) as {
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const cliPkg = JSON.parse(readRepoFile("packages/cli/package.json")) as {
      dependencies?: Record<string, string>;
    };

    expect(agenterBin).toMatch(/import "reflect-metadata";\s*import \{ runCli \} from "@agenter\/cli";/u);
    expect(cliBin).toMatch(/import "reflect-metadata";\s*import \{ runCli \} from "\.\.\/run-cli";/u);
    expect(sourcePkg.bin?.agenter).toBe("./bin/agenter.exe");
    expect(sourcePkg.dependencies).toBeUndefined();
    expect(sourcePkg.optionalDependencies?.["@agenter/cli-darwin-arm64"]).toBe("workspace:*");
    expect(wrapperSource).toContain("resolvePackageBinaryPath");
    expect(installSource).toContain("placeBinary");
    expect(cliPkg.dependencies?.["reflect-metadata"]).toBe("^0.2.2");
  });

  test("Scenario: Given npm daemon start forks a background child When inspecting the CLI source Then it reuses the current executable entrypoint", () => {
    const cliSource = readRepoFile("packages/cli/src/run-cli.ts");
    const selfExecSource = readRepoFile("packages/cli/src/self-exec.ts");

    expect(cliSource).toContain("import {");
    expect(cliSource).toContain("resolveCurrentSelfExec,");
    expect(cliSource).toContain("const selfExec = resolveCurrentSelfExec({");
    expect(cliSource).toContain(
      "spawnChildProcess(selfExec.command, [...selfExec.argvPrefix, ...buildDaemonServeArgv(args)]",
    );
    expect(selfExecSource).toContain('const BUN_COMPILED_FS_MARKER = "/$bunfs/";');
    expect(selfExecSource).toContain('return ["run", resolve(options.cliEntryPath)];');
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

    expect(shellPkg.peerDependencies?.agenter).toBe(">=0.0.10 <0.1.0");
    expect(studioPkg.peerDependencies?.agenter).toBe(">=0.0.7 <0.1.0");
    expect(shellPkg.devDependencies?.agenter).toBe("workspace:*");
    expect(studioPkg.devDependencies?.agenter).toBe("workspace:*");
    expect(buildScript).toContain("peerDependencies: input.peerDependencies ?? sourcePkg.peerDependencies");
  });

  test("Scenario: Given release CI starts from a clean checkout When building bundles Then generated prompt and native assets are built before copy", () => {
    const buildScript = readRepoFile("scripts/release/build-bundles.ts");
    const authServicePkg = JSON.parse(readRepoFile("packages/auth-service/package.json")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["build:i18n"]).toBe(
      "bun run --cwd packages/i18n-en build && bun run --cwd packages/i18n-zh-Hans build",
    );
    expect(packageJson.scripts?.["build:i18n"]).not.toContain("--filter '@agenter/i18n-*'");
    expect(buildScript).toContain('await run(["bun", "run", "build:i18n"])');
    expect(buildScript).toContain("https://ziglang.org/download/");
    expect(buildScript).toContain("stageCurrentHostGhosttyArtifact");
    expect(buildScript).toContain("await stageArtifact(repoRoot, localArtifact, target.artifactPath)");
    expect(buildScript).toContain('"@jixo/ghostty-native", "build:ghostty-native"');
    expect(buildScript).toContain('"@agenter/auth-service", "build:webauthn-ui"');
    expect(buildScript).not.toContain('"@agenter/auth-service", "build:native"');
    expect(authServicePkg.dependencies?.["@resvg/resvg-js"]).toBe("^2.6.2");
    expect(authServicePkg.dependencies?.["jpeg-js"]).toBe("^0.4.4");
    expect(authServicePkg.scripts?.["build:native"]).toBeUndefined();
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
      optionalDependencies?: Record<string, string>;
    };
    const termlessCorePkg = JSON.parse(readRepoFile("packages/termless-core/package.json")) as {
      dependencies?: Record<string, string>;
    };
    const specs = createBundlePackageSpecs();
    const ghosttySpec = specs.find((spec) => spec.bundlePackageDir === "bundle/@jixo/ghostty-native");
    const darwinArm64Spec = specs.find((spec) => spec.bundlePackageDir === "bundle/@jixo/ghostty-native-darwin-arm64");

    expect(ghosttyPkg.name).toBe("@jixo/ghostty-native");
    expect(ghosttyPkg.files).toEqual(["README.md", "src"]);
    expect(ghosttyPkg.files).not.toContain("build");
    expect(ghosttyPkg.files).not.toContain("native");
    expect(ghosttyPkg.files).not.toContain("vendor");
    expect(ghosttyPkg.optionalDependencies?.["@jixo/ghostty-native-darwin-arm64"]).toBe("workspace:*");
    expect(ghosttyPkg.optionalDependencies?.["@jixo/ghostty-native-linux-x64-gnu"]).toBe("workspace:*");
    expect(termlessCorePkg.dependencies?.["@jixo/ghostty-native"]).toBe("workspace:*");
    expect(termlessCorePkg.dependencies?.["@termless/ghostty-native"]).toBeUndefined();
    expect(ghosttySpec?.assets?.map((asset) => asset.to)).not.toContain("termless-ghostty-native.node");
    expect(ghosttySpec?.optionalDependencies?.["@jixo/ghostty-native-win32-x64-msvc"]).toBe("workspace:*");
    expect(ghosttySpec?.assets?.map((asset) => asset.to)).not.toContain("build");
    expect(ghosttySpec?.assets?.map((asset) => asset.to)).not.toContain(
      "native/zig-out/lib/termless-ghostty-native.node",
    );
    expect(darwinArm64Spec?.assets?.map((asset) => asset.to)).toContain("termless-ghostty-native.node");
    expect(darwinArm64Spec?.main).toBe("./termless-ghostty-native.node");
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
    expect(workflow).toContain("actions/setup-node@v6");
    expect(workflow).toContain('node-version: "24"');
    expect(workflow).toContain(`bun-version: "${releaseToolchain.bunVersion}"`);
    expect(workflow).not.toContain("bun-version: latest");
    expect(workflow).toContain('registry-url: "https://registry.npmjs.org"');
    expect(workflow).toContain("pattern: ghostty-native-*");
    expect(workflow).toContain("Stage ghostty-native artifacts into npm packages");
    expect(workflow).toContain('npm install -g "npm@^11.10.0"');
    expect(workflow).toContain("npm --version");
    expect(workflow).toContain("bun run release:preflight --skip-install");
    expect(workflow).toContain("changesets/action@v1");
    expect(workflow).toContain("createGithubReleases: false");
    expect(workflow).toContain('should_release: ${{ steps.agenter-release.outputs.should_release }}');
    expect(workflow).toContain('npm view "agenter@${version}" version --json');
    expect(workflow).toContain("needs.changesets.outputs.should_release == 'true'");
    expect(workflow).toContain("bun run release:prepare-packages");
    expect(workflow).toContain("softprops/action-gh-release@v3");
    expect(workflow).toContain("release-archives/agenter-cli/*.tar.gz");
    expect(workflow).toContain("release-archives/agenter-cli/agenter-release-archives.json");
    expect(workflow).toContain("bun run release:publish-bundles");
    expect(workflow).toContain("bun run release:verify-published");
    expect(workflow).toContain("bun run homebrew:generate-formula -- \\");
    expect(workflow).toContain("HOMEBREW_TAP_GITHUB_TOKEN");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("steps.changesets.outputs.published");
    expect(packageJson.scripts?.["release-packages"]).toBe(
      "bun run release:prepare-packages && bun run release:publish-bundles && bun run release:verify-published",
    );
    expect(packageJson.scripts?.["release:build-bundles:host-smoke"]).toBe(
      "bun run scripts/release/build-bundles.ts --host-only-smoke",
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
      ...releaseAgenterCliPlatformPackageJsonPaths,
      "apps/shell/package.json",
      "apps/studio/package.json",
      "packages/ghostty-native/package.json",
      ...releaseGhosttyNativePlatformPackageJsonPaths,
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
    expect(gitignore).toContain("release-archives/");
    expect(gitignore).toContain("packages/ghostty-native-*/termless-ghostty-native.node");
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
    expect(verifyScript).toContain("releasePublishOrder");
    expect(verifyScript).toContain("npm");
    expect(verifyScript).toContain("peerDependencies");
    expect(verifyScript).toContain("optionalDependencies");
  });
});
