export interface ReleasePackageJson {
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
  repository?: {
    type: string;
    url: string;
    directory?: string;
  };
}

export interface ReleaseBundleAssetSpec {
  from: string;
  to: string;
  optional?: boolean;
}

export interface ReleaseBundlePackageSpec {
  sourcePackageDir: string;
  bundlePackageDir: string;
  entry?: string;
  bin?: Record<string, string>;
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  external?: string[];
  assets?: ReleaseBundleAssetSpec[];
  bundledAssetsRoot?: boolean;
}

export const releaseToolchain = {
  bunVersion: "1.3.14",
  nodeVersion: "24",
  zigVersion: "0.15.2",
} as const;

export const releaseRepositoryUrl = "git+https://github.com/jixoai/agenter.git";
export const opentuiNativePackageVersion = "0.3.0";

export const releaseBundleManifestFiles = [
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

export const releasePublishablePackageJsonPaths = [
  "packages/agenter/package.json",
  "apps/shell/package.json",
  "apps/studio/package.json",
  "packages/ghostty-native/package.json",
] as const;

export const createReleaseBundlePackageSpecs = (): ReleaseBundlePackageSpec[] => [
  {
    sourcePackageDir: "packages/agenter",
    bundlePackageDir: "bundle/agenter",
    entry: "src/bin/agenter.ts",
    bin: { agenter: "./dist/agenter.js" },
    bundledAssetsRoot: true,
    dependencies: {
      "@parcel/watcher": "^2.5.1",
      "@jixo/ghostty-native": "workspace:*",
      "@termless/core": "^0.6.0",
    },
    // reactive-fs currently depends on missing-path watch, multi-root pooling,
    // and watcher-recovery semantics that Bun fs.watch has not matched in the
    // current evidence. Keep parcel watcher install-time/runtime-external until
    // parity is proven, rather than silently weakening the file-watching law.
    external: ["@jixo/ghostty-native", "@parcel/watcher"],
    assets: [
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
    sourcePackageDir: "apps/shell",
    bundlePackageDir: "bundle/agenter-app-shell",
    entry: "src/bin/agenter-shell.ts",
    bin: { "agenter-shell": "./dist/agenter-shell.js" },
    optionalDependencies: {
      "@opentui/core-darwin-arm64": opentuiNativePackageVersion,
      "@opentui/core-darwin-x64": opentuiNativePackageVersion,
      "@opentui/core-linux-arm64": opentuiNativePackageVersion,
      "@opentui/core-linux-x64": opentuiNativePackageVersion,
      "@opentui/core-win32-arm64": opentuiNativePackageVersion,
      "@opentui/core-win32-x64": opentuiNativePackageVersion,
    },
  },
  {
    sourcePackageDir: "apps/studio",
    bundlePackageDir: "bundle/agenter-app-studio",
    entry: "src/bin/agenter-studio.ts",
    bin: { "agenter-studio": "./dist/agenter-studio.js" },
    bundledAssetsRoot: true,
    assets: [{ from: "apps/studio/build", to: "assets/studio/build" }],
  },
  {
    sourcePackageDir: "packages/ghostty-native",
    bundlePackageDir: "bundle/@jixo/ghostty-native",
    exports: { ".": "./src/index.ts" },
    peerDependencies: { "@termless/core": "*" },
    assets: [
      { from: "packages/ghostty-native/README.md", to: "README.md" },
      { from: "packages/ghostty-native/src", to: "src" },
      { from: "packages/ghostty-native/termless-ghostty-native.node", to: "termless-ghostty-native.node" },
    ],
  },
];

export const releaseBundlePublishOrder = [
  "bundle/@jixo/ghostty-native",
  "bundle/agenter-app-shell",
  "bundle/agenter-app-studio",
  "bundle/agenter",
] as const;
