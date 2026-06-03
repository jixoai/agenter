import { chmod, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export type GhosttyPackageOs = "darwin" | "linux" | "win32";
export type GhosttyPackageArch = "arm64" | "x64";

export interface GhosttyNativeTarget {
  packageOs: GhosttyPackageOs;
  arch: GhosttyPackageArch;
  packageName: string;
  packageDir: string;
  artifactPath: string;
}

const targetTuples = [
  ["darwin", "arm64"],
  ["darwin", "x64"],
  ["linux", "arm64"],
  ["linux", "x64"],
  ["win32", "arm64"],
  ["win32", "x64"],
] as const satisfies ReadonlyArray<readonly [GhosttyPackageOs, GhosttyPackageArch]>;

export const createGhosttyNativeTarget = (
  packageOs: GhosttyPackageOs,
  arch: GhosttyPackageArch,
): GhosttyNativeTarget => {
  const packageDir = `packages/ghostty-native-${packageOs}-${arch}${packageOs === "linux" ? "-gnu" : packageOs === "win32" ? "-msvc" : ""}`;
  return {
    packageOs,
    arch,
    packageName: `@jixo/ghostty-native-${packageOs}-${arch}${packageOs === "linux" ? "-gnu" : packageOs === "win32" ? "-msvc" : ""}`,
    packageDir,
    artifactPath: `${packageDir}/termless-ghostty-native.node`,
  };
};

export const ghosttyNativeTargets: readonly GhosttyNativeTarget[] = targetTuples.map(([packageOs, arch]) =>
  createGhosttyNativeTarget(packageOs, arch),
);

export const normalizeGhosttyArch = (arch: string): GhosttyPackageArch => {
  switch (arch) {
    case "arm64":
    case "x64":
      return arch;
    default:
      throw new Error(`unsupported ghostty-native architecture: ${arch}`);
  }
};

export const normalizeGhosttyPackageOs = (platform: string): GhosttyPackageOs => {
  switch (platform) {
    case "darwin":
    case "linux":
    case "win32":
      return platform;
    case "windows":
      return "win32";
    default:
      throw new Error(`unsupported ghostty-native platform: ${platform}`);
  }
};

export const resolveGhosttyNativePackageTarget = (
  packageOs: GhosttyPackageOs,
  arch: GhosttyPackageArch,
): GhosttyNativeTarget => {
  const target = ghosttyNativeTargets.find((candidate) => candidate.packageOs === packageOs && candidate.arch === arch);
  if (!target) {
    throw new Error(`unsupported ghostty-native target: packageOs=${packageOs} arch=${arch}`);
  }
  return target;
};

export const resolveGhosttyNativeTarget = (
  platform = process.platform,
  arch = process.arch,
): GhosttyNativeTarget => resolveGhosttyNativePackageTarget(normalizeGhosttyPackageOs(platform), normalizeGhosttyArch(arch));

export const stageArtifact = async (workspaceRoot: string, source: string, destination: string): Promise<void> => {
  const absoluteDestination = join(workspaceRoot, destination);
  await mkdir(dirname(absoluteDestination), { recursive: true });
  // Platform packages are binary staging surfaces; source control stays text-only
  // and release/CI injects the host-built `.node` artifact just before pack/publish.
  await copyFile(source, absoluteDestination);
  await chmod(absoluteDestination, 0o755);
};
