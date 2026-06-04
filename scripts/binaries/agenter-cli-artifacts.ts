export type AgenterCliPackageOs = "darwin" | "linux" | "win32";
export type AgenterCliPackageArch = "arm64" | "x64";
export type AgenterCliPackageLibc = "gnu" | "musl";
export type AgenterCliArchiveFormat = "tar.gz" | "zip";
export type AgenterCliBunTarget =
  | "bun-darwin-arm64"
  | "bun-darwin-x64"
  | "bun-linux-arm64"
  | "bun-linux-arm64-musl"
  | "bun-linux-x64"
  | "bun-linux-x64-musl"
  | "bun-windows-arm64"
  | "bun-windows-x64";

export interface AgenterCliTarget {
  packageOs: AgenterCliPackageOs;
  arch: AgenterCliPackageArch;
  libc?: AgenterCliPackageLibc;
  bunTarget: AgenterCliBunTarget;
  targetId: string;
  packageName: string;
  packageDir: string;
  binaryName: string;
  packageBinaryPath: string;
  artifactPath: string;
  archiveFormat: AgenterCliArchiveFormat;
  archiveStem: string;
  archiveFileName: string;
  archiveBinaryPath: string;
  checksumFileName: string;
  homebrewTargetId: string;
}

// This file is the release-side truth for the public native CLI package names
// and target matrix. Wrapper/runtime projections must follow this surface.
export const agenterCliPublicPackagePrefix = "@jixoai/cli";
export const agenterCliPublicPackageNamePrefix = `${agenterCliPublicPackagePrefix}-`;

const targetTuples = [
  ["darwin", "arm64"],
  ["darwin", "x64"],
  ["linux", "arm64", "gnu"],
  ["linux", "arm64", "musl"],
  ["linux", "x64", "gnu"],
  ["linux", "x64", "musl"],
  ["win32", "arm64"],
  ["win32", "x64"],
] as const satisfies ReadonlyArray<
  readonly [AgenterCliPackageOs, AgenterCliPackageArch, AgenterCliPackageLibc?]
>;

const toTargetId = (
  packageOs: AgenterCliPackageOs,
  arch: AgenterCliPackageArch,
  libc?: AgenterCliPackageLibc,
): string => (packageOs === "linux" ? `${packageOs}-${arch}-${libc}` : `${packageOs}-${arch}`);

const toBunTarget = (
  packageOs: AgenterCliPackageOs,
  arch: AgenterCliPackageArch,
  libc?: AgenterCliPackageLibc,
): AgenterCliBunTarget => {
  if (packageOs === "darwin") {
    return `bun-darwin-${arch}`;
  }
  if (packageOs === "win32") {
    return `bun-windows-${arch}`;
  }
  if (packageOs === "linux" && libc === "musl") {
    return `bun-linux-${arch}-musl`;
  }
  if (packageOs === "linux" && libc === "gnu") {
    return `bun-linux-${arch}`;
  }
  throw new Error(`unsupported bun target mapping: packageOs=${packageOs} arch=${arch} libc=${libc ?? "none"}`);
};

const toArchiveFormat = (packageOs: AgenterCliPackageOs): AgenterCliArchiveFormat =>
  packageOs === "win32" ? "zip" : "tar.gz";

export const createAgenterCliTarget = (
  packageOs: AgenterCliPackageOs,
  arch: AgenterCliPackageArch,
  libc?: AgenterCliPackageLibc,
): AgenterCliTarget => {
  const targetId = toTargetId(packageOs, arch, libc);
  const binaryName = packageOs === "win32" ? "agenter.exe" : "agenter";
  const packageDir = `packages/agenter-cli-${targetId}`;
  const packageBinaryPath = `bin/${binaryName}`;
  const archiveStem = `agenter-${targetId}`;
  const archiveFormat = toArchiveFormat(packageOs);
  return {
    packageOs,
    arch,
    libc,
    bunTarget: toBunTarget(packageOs, arch, libc),
    targetId,
    packageName: `${agenterCliPublicPackageNamePrefix}${targetId}`,
    packageDir,
    binaryName,
    packageBinaryPath,
    artifactPath: `${packageDir}/${packageBinaryPath}`,
    archiveFormat,
    archiveStem,
    archiveFileName: `${archiveStem}.${archiveFormat}`,
    archiveBinaryPath: binaryName,
    checksumFileName: `${archiveStem}.sha256`,
    homebrewTargetId: targetId,
  };
};

export const agenterCliTargets: readonly AgenterCliTarget[] = targetTuples.map(([packageOs, arch, libc]) =>
  createAgenterCliTarget(packageOs, arch, libc),
);

export const agenterCliPlatformPackageJsonPaths: readonly string[] = agenterCliTargets.map(
  (target) => `${target.packageDir}/package.json`,
);

export const createAgenterCliNativeArtifactPath = (rootDir: string, target: AgenterCliTarget): string =>
  `${rootDir}/agenter-cli-${target.targetId}/${target.binaryName}`;

export const createAgenterCliArchivePath = (rootDir: string, target: AgenterCliTarget): string =>
  `${rootDir}/${target.archiveFileName}`;

export const normalizeAgenterCliArch = (arch: string): AgenterCliPackageArch => {
  switch (arch) {
    case "arm64":
    case "x64":
      return arch;
    default:
      throw new Error(`unsupported agenter CLI architecture: ${arch}`);
  }
};

export const normalizeAgenterCliPackageOs = (platform: string): AgenterCliPackageOs => {
  switch (platform) {
    case "darwin":
    case "linux":
    case "win32":
      return platform;
    case "windows":
      return "win32";
    default:
      throw new Error(`unsupported agenter CLI platform: ${platform}`);
  }
};

export const normalizeAgenterCliPackageLibc = (libc: string): AgenterCliPackageLibc => {
  switch (libc) {
    case "gnu":
    case "musl":
      return libc;
    default:
      throw new Error(`unsupported agenter CLI libc: ${libc}`);
  }
};

export const resolveAgenterCliPackageTarget = (
  packageOs: AgenterCliPackageOs,
  arch: AgenterCliPackageArch,
  libc?: AgenterCliPackageLibc,
): AgenterCliTarget => {
  if (packageOs === "linux" && !libc) {
    throw new Error("linux agenter CLI target resolution requires explicit libc");
  }
  const target = agenterCliTargets.find(
    (candidate) => candidate.packageOs === packageOs && candidate.arch === arch && candidate.libc === libc,
  );
  if (!target) {
    throw new Error(`unsupported agenter CLI target: packageOs=${packageOs} arch=${arch} libc=${libc ?? "none"}`);
  }
  return target;
};

export const resolveAgenterCliTargetById = (targetId: string): AgenterCliTarget => {
  const target = agenterCliTargets.find((candidate) => candidate.targetId === targetId);
  if (!target) {
    throw new Error(`unsupported agenter CLI target id: ${targetId}`);
  }
  return target;
};

const detectCurrentLinuxLibc = (): AgenterCliPackageLibc => {
  const envValue = process.env.AGENTER_CLI_LIBC?.trim();
  if (envValue) {
    return normalizeAgenterCliPackageLibc(envValue);
  }
  const report = typeof process.report?.getReport === "function" ? process.report.getReport() : null;
  const header = report && typeof report === "object" && "header" in report ? report.header : null;
  const glibcVersionRuntime =
    header && typeof header === "object" && "glibcVersionRuntime" in header ? header.glibcVersionRuntime : undefined;
  return typeof glibcVersionRuntime === "string" && glibcVersionRuntime.length > 0 ? "gnu" : "musl";
};

export const resolveCurrentAgenterCliTarget = (
  platform = process.platform,
  arch = process.arch,
  linuxLibc?: AgenterCliPackageLibc,
): AgenterCliTarget => {
  const packageOs = normalizeAgenterCliPackageOs(platform);
  const packageArch = normalizeAgenterCliArch(arch);
  const libc = packageOs === "linux" ? (linuxLibc ?? detectCurrentLinuxLibc()) : undefined;
  return resolveAgenterCliPackageTarget(packageOs, packageArch, libc);
};
