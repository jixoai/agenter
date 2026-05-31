import { existsSync } from "node:fs";
import { chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  createReleaseBundlePackageSpecs,
  releaseBundleManifestFiles,
  releaseNativeLibrarySuffix,
  releasePublishablePackageJsonPaths,
  releaseRepositoryUrl,
  releaseToolchain,
  type ReleaseBundleAssetSpec,
  type ReleaseBundlePackageSpec,
  type ReleasePackageJson,
} from "./release-manifest";

const repoRoot = resolve(import.meta.dir, "../..");
const bundleRoot = join(repoRoot, "bundle");
const expectedZigVersion = releaseToolchain.zigVersion;
const releaseZigRoot = `/tmp/zig-${expectedZigVersion}`;
const releaseZigBin = join(releaseZigRoot, "zig");

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
    bin: packageBin,
    exports: input.exports,
    files: releaseBundleManifestFiles.filter((entry) => existsSync(join(bundlePackageDir, entry))),
    dependencies: input.dependencies ? normalizeWorkspaceDependencies(input.dependencies) : undefined,
    optionalDependencies: input.optionalDependencies
      ? normalizeWorkspaceDependencies(input.optionalDependencies)
      : undefined,
    peerDependencies: input.peerDependencies ?? sourcePkg.peerDependencies,
    engines: sourcePkg.engines ?? { bun: ">=1.3.10" },
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

const ensureNativeAssets = async (): Promise<void> => {
  const zigBin = await ensureReleaseZig();
  await run(["bun", "run", "--filter", "@jixo/ghostty-native", "build:ghostty-native"], repoRoot, { ZIG_BIN: zigBin });
  await run(["bun", "run", "--filter", "@agenter/auth-service", "build:native"]);
  await run(["bun", "run", "--filter", "@agenter/auth-service", "build:webauthn-ui"]);
};

export const createBundlePackageSpecs = createReleaseBundlePackageSpecs;

export const buildReleaseBundles = async (): Promise<void> => {
  await rm(bundleRoot, { recursive: true, force: true });
  await mkdir(bundleRoot, { recursive: true });
  await readWorkspacePackageVersion("@jixo/ghostty-native");
  await ensureI18nAssets();
  await ensureStudioBuild();
  await ensureNativeAssets();

  for (const spec of createBundlePackageSpecs()) {
    await buildBundle(spec);
  }

  await writeFile(join(bundleRoot, ".gitignore"), "*\n!.gitignore\n");
  console.log("Release bundles written to ./bundle");
  console.log(`Auth resvg suffix: ${releaseNativeLibrarySuffix}`);
};

if (import.meta.main) {
  await buildReleaseBundles();
}
