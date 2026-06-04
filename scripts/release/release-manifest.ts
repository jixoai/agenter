import { agenterCliPlatformPackageJsonPaths, agenterCliTargets } from "../binaries/agenter-cli-artifacts";
import { ghosttyNativeTargets } from "../binaries/artifacts";

export interface ReleasePackageJson {
  name: string;
  version: string;
  description?: string;
  license?: string;
  type?: string;
  main?: string;
  bin?: Record<string, string>;
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  publishConfig?: Record<string, string>;
  os?: string[];
  cpu?: string[];
  libc?: string[];
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
  main?: string;
  bin?: Record<string, string>;
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
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
  "CHANGELOG.md",
  "SPEC.md",
  "cli-wrapper.cjs",
  "install.cjs",
  "native-platform.cjs",
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

export const releaseGhosttyNativePlatformPackageJsonPaths = ghosttyNativeTargets.map(
  (target) => `${target.packageDir}/package.json`,
);
export const releaseAgenterCliPlatformPackageJsonPaths = agenterCliPlatformPackageJsonPaths;

export const releasePublishablePackageJsonPaths = [
  "packages/agenter/package.json",
  ...agenterCliPlatformPackageJsonPaths,
  "apps/shell/package.json",
  "apps/studio/package.json",
  "packages/ghostty-native/package.json",
  ...releaseGhosttyNativePlatformPackageJsonPaths,
] as const;

export const createReleaseBundlePackageSpecs = (): ReleaseBundlePackageSpec[] => {
  const ghosttyPlatformSpecs: ReleaseBundlePackageSpec[] = ghosttyNativeTargets.map((target) => ({
    sourcePackageDir: target.packageDir,
    bundlePackageDir: `bundle/${target.packageName}`,
    main: "./termless-ghostty-native.node",
    assets: [
      { from: `${target.packageDir}/README.md`, to: "README.md" },
      { from: `${target.packageDir}/termless-ghostty-native.node`, to: "termless-ghostty-native.node" },
    ],
  }));

  return [
    {
      sourcePackageDir: "packages/agenter",
      bundlePackageDir: "bundle/agenter",
      // packages/agenter stays as workspace truth. The publish truth that npm
      // sees is this generated bundle projection, so workspace:* never leaks
      // into the public wrapper manifest.
      scripts: { postinstall: "node ./install.cjs" },
      optionalDependencies: Object.fromEntries(agenterCliTargets.map((target) => [target.packageName, "workspace:*"])),
      assets: [
        { from: "packages/agenter/CHANGELOG.md", to: "CHANGELOG.md" },
        { from: "packages/agenter/SPEC.md", to: "SPEC.md" },
        { from: "packages/agenter/bin", to: "bin" },
        { from: "packages/agenter/cli-wrapper.cjs", to: "cli-wrapper.cjs" },
        { from: "packages/agenter/install.cjs", to: "install.cjs" },
        { from: "packages/agenter/native-platform.cjs", to: "native-platform.cjs" },
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
      optionalDependencies: {
        "@jixo/ghostty-native-darwin-arm64": "workspace:*",
        "@jixo/ghostty-native-darwin-x64": "workspace:*",
        "@jixo/ghostty-native-linux-arm64-gnu": "workspace:*",
        "@jixo/ghostty-native-linux-x64-gnu": "workspace:*",
        "@jixo/ghostty-native-win32-arm64-msvc": "workspace:*",
        "@jixo/ghostty-native-win32-x64-msvc": "workspace:*",
      },
      peerDependencies: { "@termless/core": "*" },
      assets: [
        { from: "packages/ghostty-native/README.md", to: "README.md" },
        { from: "packages/ghostty-native/src", to: "src" },
      ],
    },
    ...ghosttyPlatformSpecs,
  ];
};

export const releaseBundlePublishOrder = [
  "bundle/@jixo/ghostty-native-darwin-arm64",
  "bundle/@jixo/ghostty-native-darwin-x64",
  "bundle/@jixo/ghostty-native-linux-arm64-gnu",
  "bundle/@jixo/ghostty-native-linux-x64-gnu",
  "bundle/@jixo/ghostty-native-win32-arm64-msvc",
  "bundle/@jixo/ghostty-native-win32-x64-msvc",
  "bundle/@jixo/ghostty-native",
  "bundle/agenter",
  "bundle/agenter-app-shell",
  "bundle/agenter-app-studio",
] as const;

export const releasePublishOrder: readonly string[] = [
  "bundle/@jixo/ghostty-native-darwin-arm64",
  "bundle/@jixo/ghostty-native-darwin-x64",
  "bundle/@jixo/ghostty-native-linux-arm64-gnu",
  "bundle/@jixo/ghostty-native-linux-x64-gnu",
  "bundle/@jixo/ghostty-native-win32-arm64-msvc",
  "bundle/@jixo/ghostty-native-win32-x64-msvc",
  "bundle/@jixo/ghostty-native",
  ...agenterCliTargets.map((target) => target.packageDir),
  "bundle/agenter",
  "bundle/agenter-app-shell",
  "bundle/agenter-app-studio",
];
