import { existsSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { suffix } from "bun:ffi";

interface PackageJson {
  name: string;
  version: string;
  description?: string;
  license?: string;
  type?: string;
  bin?: Record<string, string>;
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  publishConfig?: Record<string, string>;
}

interface BundleAssetSpec {
  from: string;
  to: string;
  optional?: boolean;
}

interface BundlePackageSpec {
  sourcePackageDir: string;
  bundlePackageDir: string;
  entry?: string;
  bin?: Record<string, string>;
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  external?: string[];
  assets?: BundleAssetSpec[];
  bundledAssetsRoot?: boolean;
}

const repoRoot = resolve(import.meta.dir, "../..");
const bundleRoot = join(repoRoot, "bundle");
const expectedZigVersion = "0.15.2";
const releaseZigRoot = `/tmp/zig-${expectedZigVersion}`;
const releaseZigBin = join(releaseZigRoot, "zig");
const bundleManifestFiles = [
  "bin",
  "dist",
  "assets",
  "build",
  "native",
  "vendor",
  "src",
  "README.md",
  "termless-ghostty-native.node",
] as const;
const publishablePackageJsonPaths = [
  "packages/agenter/package.json",
  "extensions/cli-shell/package.json",
  "packages/studio/package.json",
  "packages/ghostty-native/package.json",
] as const;

const readJson = async <T>(path: string): Promise<T> => (await Bun.file(path).json()) as T;

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const copyAsset = async (asset: BundleAssetSpec, bundlePackageDir: string): Promise<void> => {
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
      "const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), \"..\");",
      assetRootLine,
      `await import(${JSON.stringify(`../${distImportPath.replace(/^\.\//u, "")}`)});`,
      "",
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
  );
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

const buildBundle = async (input: BundlePackageSpec): Promise<void> => {
  const sourcePackageDir = join(repoRoot, input.sourcePackageDir);
  const bundlePackageDir = join(repoRoot, input.bundlePackageDir);
  const sourcePkg = await readJson<PackageJson>(join(sourcePackageDir, "package.json"));
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
    files: bundleManifestFiles.filter((entry) =>
      existsSync(join(bundlePackageDir, entry)),
    ),
    dependencies: input.dependencies ? normalizeWorkspaceDependencies(input.dependencies) : undefined,
    optionalDependencies: input.optionalDependencies
      ? normalizeWorkspaceDependencies(input.optionalDependencies)
      : undefined,
    peerDependencies: input.peerDependencies,
    engines: sourcePkg.engines ?? { bun: ">=1.3.10" },
    publishConfig: { access: "public" },
  });
};

const packageVersions = new Map<string, string>();

const readWorkspacePackageVersion = async (packageName: string): Promise<string> => {
  const cached = packageVersions.get(packageName);
  if (cached) {
    return cached;
  }
  for (const relativePath of publishablePackageJsonPaths) {
    const pkg = await readJson<PackageJson>(join(repoRoot, relativePath));
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
  await run(["bun", "run", "--filter", "agenter-ext-studio", "build"]);
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
  throw new Error(`automatic Zig ${expectedZigVersion} bootstrap is not configured for ${process.platform}/${process.arch}`);
};

const ensureReleaseZig = async (): Promise<string> => {
  if (existsSync(releaseZigBin)) {
    return releaseZigBin;
  }
  const archiveName = resolveZigArchiveName();
  const archivePath = `/tmp/${archiveName}.tar.xz`;
  await run(["curl", "-L", `https://ziglang.org/download/${expectedZigVersion}/${archiveName}.tar.xz`, "-o", archivePath]);
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

export const createBundlePackageSpecs = (): BundlePackageSpec[] => [
  {
    sourcePackageDir: "packages/agenter",
    bundlePackageDir: "bundle/agenter",
    entry: "src/bin/agenter.ts",
    bin: { agenter: "./dist/agenter.js" },
    bundledAssetsRoot: true,
    dependencies: {
      "@duckdb/node-api": "^1.5.1-r.1",
      "@jixo/ghostty-native": "workspace:*",
      "@termless/core": "^0.6.0",
    },
    external: ["@duckdb/node-api", "@jixo/ghostty-native"],
    assets: [
      {
        from: `packages/auth-service/native/resvg_bridge/target/release/libprofile_resvg_bridge.${suffix}`,
        to: `assets/auth-service/native/resvg_bridge/target/release/libprofile_resvg_bridge.${suffix}`,
      },
      { from: "packages/auth-service/src/server/webauthn-ui", to: "assets/auth-service/webauthn-ui" },
      { from: "packages/i18n-en/prompts", to: "assets/i18n-en/prompts" },
      { from: "packages/i18n-en/prompts.json", to: "assets/i18n-en/prompts.json" },
      { from: "packages/i18n-en/runtime.json", to: "assets/i18n-en/runtime.json" },
      { from: "packages/i18n-zh-Hans/prompts", to: "assets/i18n-zh-Hans/prompts" },
      { from: "packages/i18n-zh-Hans/prompts.json", to: "assets/i18n-zh-Hans/prompts.json" },
      { from: "packages/i18n-zh-Hans/runtime.json", to: "assets/i18n-zh-Hans/runtime.json" },
    ],
  },
  {
    sourcePackageDir: "extensions/cli-shell",
    bundlePackageDir: "bundle/agenter-ext-shell",
    entry: "src/bin/agenter-cli-shell.ts",
    bin: { "agenter-cli-shell": "./dist/agenter-cli-shell.js" },
    optionalDependencies: {
      "@opentui/core-darwin-arm64": "0.2.15",
      "@opentui/core-darwin-x64": "0.2.15",
      "@opentui/core-linux-arm64": "0.2.15",
      "@opentui/core-linux-x64": "0.2.15",
      "@opentui/core-win32-arm64": "0.2.15",
      "@opentui/core-win32-x64": "0.2.15",
    },
  },
  {
    sourcePackageDir: "packages/studio",
    bundlePackageDir: "bundle/agenter-ext-studio",
    entry: "src/bin/agenter-studio.ts",
    bin: { "agenter-studio": "./dist/agenter-studio.js" },
    bundledAssetsRoot: true,
    assets: [{ from: "packages/studio/build", to: "assets/studio/build" }],
  },
  {
    sourcePackageDir: "packages/ghostty-native",
    bundlePackageDir: "bundle/@jixo/ghostty-native",
    exports: { ".": "./src/index.ts" },
    peerDependencies: { "@termless/core": "*" },
    assets: [
      { from: "packages/ghostty-native/README.md", to: "README.md" },
      { from: "packages/ghostty-native/src", to: "src" },
      { from: "packages/ghostty-native/build", to: "build" },
      { from: "packages/ghostty-native/native/build.zig", to: "native/build.zig" },
      { from: "packages/ghostty-native/native/build.zig.zon", to: "native/build.zig.zon" },
      { from: "packages/ghostty-native/native/src", to: "native/src" },
      { from: "packages/ghostty-native/vendor", to: "vendor" },
      { from: "packages/ghostty-native/termless-ghostty-native.node", to: "termless-ghostty-native.node" },
      {
        from: `packages/ghostty-native/native/zig-out/lib/termless-ghostty-native.node`,
        to: `native/zig-out/lib/termless-ghostty-native.node`,
      },
    ],
  },
];

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
  console.log(`Auth resvg suffix: ${suffix}`);
};

if (import.meta.main) {
  await buildReleaseBundles();
}
