import { existsSync } from "node:fs";
import { chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { ghosttyNativeTargets, resolveGhosttyNativeTarget, stageArtifact } from "../binaries/artifacts";
import {
  createReleaseBundlePackageSpecs,
  releaseBundleManifestFiles,
  releasePublishablePackageJsonPaths,
  releaseRepositoryUrl,
  releaseToolchain,
  type ReleaseBundleAssetSpec,
  type ReleaseBundlePackageSpec,
  type ReleasePackageJson,
} from "./release-manifest";

const repoRoot = resolve(import.meta.dir, "../..");
const expectedZigVersion = releaseToolchain.zigVersion;
const releaseZigRoot = `/tmp/zig-${expectedZigVersion}`;
const releaseZigBin = join(releaseZigRoot, "zig");
const bundleRootNames = {
  release: "bundle",
  "host-only-smoke": "bundle-host-smoke",
} as const;

export type BundleBuildMode = keyof typeof bundleRootNames;

interface BuildBundleOptions {
  mode: BundleBuildMode;
}

const defaultBuildBundleOptions: BuildBundleOptions = {
  mode: "release",
};

const resolveBundleRoot = (mode: BundleBuildMode): string => join(repoRoot, bundleRootNames[mode]);
const bundleDirForMode = (bundlePackageDir: string, mode: BundleBuildMode): string =>
  mode === "release" ? bundlePackageDir : bundlePackageDir.replace(/^bundle\//u, `${bundleRootNames[mode]}/`);

const ghosttyPlatformBundleDirs = new Set(ghosttyNativeTargets.map((target) => `bundle/${target.packageName}`));

const readJson = async <T>(path: string): Promise<T> => (await Bun.file(path).json()) as T;

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const copyAsset = async (asset: ReleaseBundleAssetSpec, bundlePackageDir: string): Promise<void> => {
  const from = join(repoRoot, asset.from);
  const to = join(bundlePackageDir, asset.to);
  if (existsSync(from)) {
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to, { recursive: true });
    return;
  }
  if (!asset.optional) {
    throw new Error(`required bundle asset is missing: ${asset.from}`);
  }
};

const run = async (cmd: string[], cwd = repoRoot, env: Record<string, string> = {}): Promise<void> => {
  const proc = Bun.spawn({
    cmd,
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed with exit code ${exitCode}`);
  }
};

const createBundledBinWrapper = async (input: {
  bundlePackageDir: string;
  binPath: string;
  distPath: string;
  bundledAssetsRoot: boolean;
}): Promise<void> => {
  const binAbsolutePath = join(input.bundlePackageDir, input.binPath);
  const distImportPath = input.distPath.startsWith("./") ? input.distPath : `./${input.distPath}`;
  const assetRootLine = input.bundledAssetsRoot
    ? 'process.env.AGENTER_BUNDLED_ASSETS_ROOT = resolve(packageRoot, "assets");'
    : "";
  await mkdir(dirname(binAbsolutePath), { recursive: true });
  await writeFile(
    binAbsolutePath,
    [
      "#!/usr/bin/env bun",
      'import { dirname, resolve } from "node:path";',
      'import { fileURLToPath } from "node:url";',
      "",
      'const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");',
      assetRootLine,
      `await import(${JSON.stringify(`../${distImportPath.replace(/^\.\//u, "")}`)});`,
      "",
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
  );
  await chmod(binAbsolutePath, 0o755);
};

const toWrapperBin = (
  bin: Record<string, string> | undefined,
  entry: string | undefined,
): { packageBin: Record<string, string> | undefined; wrappers: Array<{ binPath: string; distPath: string }> } => {
  if (!bin || !entry) {
    return { packageBin: bin, wrappers: [] };
  }
  return {
    packageBin: Object.fromEntries(Object.keys(bin).map((name) => [name, `bin/${name}.js`])),
    wrappers: Object.keys(bin).map((name) => ({
      binPath: `bin/${name}.js`,
      distPath: `dist/${entry.split("/").at(-1)?.replace(/\.ts$/u, ".js") ?? `${name}.js`}`,
    })),
  };
};

const buildBundle = async (input: ReleaseBundlePackageSpec): Promise<void> => {
  const sourcePackageDir = join(repoRoot, input.sourcePackageDir);
  const bundlePackageDir = join(repoRoot, input.bundlePackageDir);
  const sourcePkg = await readJson<ReleasePackageJson>(join(sourcePackageDir, "package.json"));
  await rm(bundlePackageDir, { recursive: true, force: true });
  await mkdir(bundlePackageDir, { recursive: true });

  if (input.entry) {
    await run([
      "bun",
      "build",
      join(sourcePackageDir, input.entry),
      "--bundle",
      "--target=bun",
      "--outdir",
      join(bundlePackageDir, "dist"),
      ...(input.external ?? []).flatMap((name) => ["--external", name]),
    ]);
  }

  for (const asset of input.assets ?? []) {
    await copyAsset(asset, bundlePackageDir);
  }

  const { packageBin, wrappers } = toWrapperBin(input.bin, input.entry);
  for (const wrapper of wrappers) {
    await createBundledBinWrapper({
      bundlePackageDir,
      binPath: wrapper.binPath,
      distPath: wrapper.distPath,
      bundledAssetsRoot: input.bundledAssetsRoot ?? false,
    });
  }

  await writeJson(join(bundlePackageDir, "package.json"), {
    name: sourcePkg.name,
    version: sourcePkg.version,
    description: sourcePkg.description,
    license: sourcePkg.license,
    type: sourcePkg.type ?? "module",
    main: input.main ?? sourcePkg.main,
    bin: packageBin,
    exports: input.exports ?? sourcePkg.exports,
    files: releaseBundleManifestFiles.filter((entry) => existsSync(join(bundlePackageDir, entry))),
    dependencies: input.dependencies ? normalizeWorkspaceDependencies(input.dependencies) : undefined,
    optionalDependencies: input.optionalDependencies
      ? normalizeWorkspaceDependencies(input.optionalDependencies)
      : undefined,
    peerDependencies: input.peerDependencies ?? sourcePkg.peerDependencies,
    scripts: input.scripts,
    engines: sourcePkg.engines ?? { bun: ">=1.3.10" },
    os: sourcePkg.os,
    cpu: sourcePkg.cpu,
    libc: sourcePkg.libc,
    repository: {
      type: "git",
      url: releaseRepositoryUrl,
      directory: input.sourcePackageDir,
    },
    publishConfig: { access: "public" },
  });
};

const packageVersions = new Map<string, string>();

const readWorkspacePackageVersion = async (packageName: string): Promise<string> => {
  const cached = packageVersions.get(packageName);
  if (cached) {
    return cached;
  }
  for (const relativePath of releasePublishablePackageJsonPaths) {
    const pkg = await readJson<ReleasePackageJson>(join(repoRoot, relativePath));
    packageVersions.set(pkg.name, pkg.version);
  }
  const version = packageVersions.get(packageName);
  if (!version) {
    throw new Error(`missing workspace package version for ${packageName}`);
  }
  return version;
};

const normalizeWorkspaceDependencies = (dependencies: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(dependencies).map(([name, version]) => [
      name,
      version === "workspace:*" ? `^${packageVersions.get(name) ?? failMissingVersion(name)}` : version,
    ]),
  );

const failMissingVersion = (packageName: string): never => {
  throw new Error(`missing bundled dependency version for ${packageName}`);
};

const ensureStudioBuild = async (): Promise<void> => {
  await run(["bun", "run", "--filter", "agenter-app-studio", "build"]);
};

const ensureI18nAssets = async (): Promise<void> => {
  await run(["bun", "run", "build:i18n"]);
};

const resolveZigArchiveName = (): string => {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return `zig-aarch64-macos-${expectedZigVersion}`;
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return `zig-x86_64-macos-${expectedZigVersion}`;
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return `zig-x86_64-linux-${expectedZigVersion}`;
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return `zig-aarch64-linux-${expectedZigVersion}`;
  }
  throw new Error(
    `automatic Zig ${expectedZigVersion} bootstrap is not configured for ${process.platform}/${process.arch}`,
  );
};

const ensureReleaseZig = async (): Promise<string> => {
  if (existsSync(releaseZigBin)) {
    return releaseZigBin;
  }
  const archiveName = resolveZigArchiveName();
  const archivePath = `/tmp/${archiveName}.tar.xz`;
  await run([
    "curl",
    "-L",
    `https://ziglang.org/download/${expectedZigVersion}/${archiveName}.tar.xz`,
    "-o",
    archivePath,
  ]);
  await rm(releaseZigRoot, { recursive: true, force: true });
  await run(["tar", "-xf", archivePath, "-C", "/tmp"]);
  await run(["mv", `/tmp/${archiveName}`, releaseZigRoot]);
  return releaseZigBin;
};

const stageCurrentHostGhosttyArtifact = async (): Promise<void> => {
  const target = resolveGhosttyNativeTarget();
  const stagedArtifact = join(repoRoot, target.artifactPath);
  if (existsSync(stagedArtifact)) {
    return;
  }
  const zigBin = await ensureReleaseZig();
  await run(["bun", "run", "--filter", "@jixo/ghostty-native", "build:ghostty-native"], repoRoot, { ZIG_BIN: zigBin });
  const localArtifact = join(repoRoot, "packages/ghostty-native/termless-ghostty-native.node");
  if (!existsSync(localArtifact)) {
    throw new Error(`ghostty-native local build did not produce ${localArtifact}`);
  }
  // Local release smoke should still work on the current host without staging
  // every foreign target by hand; CI pre-stages the full matrix before publish.
  await stageArtifact(repoRoot, localArtifact, target.artifactPath);
};

const ensureNativeAssets = async (): Promise<void> => {
  await stageCurrentHostGhosttyArtifact();
  await run(["bun", "run", "--filter", "@agenter/auth-service", "build:webauthn-ui"]);
};

export const createHostOnlySmokeBundlePackageSpecs = (
  platform = process.platform,
  arch = process.arch,
): ReleaseBundlePackageSpec[] => {
  const target = resolveGhosttyNativeTarget(platform, arch);
  const currentHostBundleDir = `bundle/${target.packageName}`;
  return createReleaseBundlePackageSpecs()
    .filter((spec) => !ghosttyPlatformBundleDirs.has(spec.bundlePackageDir) || spec.bundlePackageDir === currentHostBundleDir)
    .map((spec) => ({
      ...spec,
      bundlePackageDir: bundleDirForMode(spec.bundlePackageDir, "host-only-smoke"),
    }));
};

export const createBundlePackageSpecs = (mode: BundleBuildMode = "release"): ReleaseBundlePackageSpec[] =>
  mode === "release" ? createReleaseBundlePackageSpecs() : createHostOnlySmokeBundlePackageSpecs();

export const parseBuildBundlesArgs = (args: string[]): BuildBundleOptions => {
  const options = { ...defaultBuildBundleOptions };
  for (const arg of args) {
    if (arg === "--host-only-smoke") {
      options.mode = "host-only-smoke";
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return options;
};

export const buildReleaseBundles = async (options: BuildBundleOptions = defaultBuildBundleOptions): Promise<void> => {
  const bundleRoot = resolveBundleRoot(options.mode);
  await rm(bundleRoot, { recursive: true, force: true });
  await mkdir(bundleRoot, { recursive: true });
  for (const packageJsonPath of releasePublishablePackageJsonPaths) {
    const packageName = (await readJson<ReleasePackageJson>(join(repoRoot, packageJsonPath))).name;
    await readWorkspacePackageVersion(packageName);
  }
  await ensureI18nAssets();
  await ensureStudioBuild();
  await ensureNativeAssets();

  for (const spec of createBundlePackageSpecs(options.mode)) {
    await buildBundle(spec);
  }

  await writeFile(join(bundleRoot, ".gitignore"), "*\n!.gitignore\n");
  if (options.mode === "host-only-smoke") {
    const target = resolveGhosttyNativeTarget();
    // Host-only smoke is a local honesty path: it proves the current machine's
    // staging and bundle chain without pretending the full cross-platform
    // artifact matrix has already been built or validated.
    await writeJson(join(bundleRoot, "host-only-smoke.json"), {
      mode: options.mode,
      packageName: target.packageName,
      platform: target.packageOs,
      arch: target.arch,
      skippedPlatformPackages: ghosttyNativeTargets
        .filter((candidate) => candidate.packageName !== target.packageName)
        .map((candidate) => candidate.packageName),
    });
  }
  console.log(
    options.mode === "release"
      ? "Release bundles written to ./bundle"
      : "Host-only smoke bundles written to ./bundle-host-smoke",
  );
};

if (import.meta.main) {
  await buildReleaseBundles(parseBuildBundlesArgs(Bun.argv.slice(2)));
}
