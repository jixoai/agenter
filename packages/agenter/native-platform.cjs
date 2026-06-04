const path = require("path");
const { arch: osArch } = require("os");

const PACKAGE_PREFIX = "@jixoai/cli";
const PACKAGE_NAME_PREFIX = `${PACKAGE_PREFIX}-`;
const BINARY_NAME = "agenter";
const PUBLIC_BIN_PATH = path.join("bin", "agenter.exe");

// This JS module is the published wrapper's local projection of the repo target
// truth. Tests pin it against scripts/binaries/agenter-cli-artifacts.ts so the
// install surface cannot silently drift from the release/archive matrix.
const PLATFORMS = Object.freeze({
  "darwin-arm64": { pkg: `${PACKAGE_PREFIX}-darwin-arm64`, bin: BINARY_NAME },
  "darwin-x64": { pkg: `${PACKAGE_PREFIX}-darwin-x64`, bin: BINARY_NAME },
  "linux-arm64-gnu": { pkg: `${PACKAGE_PREFIX}-linux-arm64-gnu`, bin: BINARY_NAME },
  "linux-arm64-musl": { pkg: `${PACKAGE_PREFIX}-linux-arm64-musl`, bin: BINARY_NAME },
  "linux-x64-gnu": { pkg: `${PACKAGE_PREFIX}-linux-x64-gnu`, bin: BINARY_NAME },
  "linux-x64-musl": { pkg: `${PACKAGE_PREFIX}-linux-x64-musl`, bin: BINARY_NAME },
  "win32-arm64": { pkg: `${PACKAGE_PREFIX}-win32-arm64`, bin: `${BINARY_NAME}.exe` },
  "win32-x64": { pkg: `${PACKAGE_PREFIX}-win32-x64`, bin: `${BINARY_NAME}.exe` },
});

const SUPPORTED_PLATFORM_KEYS = Object.freeze(Object.keys(PLATFORMS));

function detectLinuxLibc(env = process.env, reportGetter = process.report?.getReport) {
  const envValue = env.AGENTER_CLI_LIBC?.trim();
  if (envValue === "gnu" || envValue === "musl") {
    return envValue;
  }
  if (envValue) {
    throw new Error(`unsupported AGENTER_CLI_LIBC override: ${envValue}`);
  }
  const report = typeof reportGetter === "function" ? reportGetter.call(process.report) : null;
  return report?.header?.glibcVersionRuntime ? "gnu" : "musl";
}

function resolvePlatformKey(runtime = {}) {
  const platform = runtime.platform ?? process.platform;
  const arch = runtime.arch ?? osArch();
  if (platform === "linux") {
    return `${platform}-${arch}-${runtime.linuxLibc ?? detectLinuxLibc(runtime.env, runtime.reportGetter)}`;
  }
  return `${platform}-${arch}`;
}

function resolvePlatformInfo(runtime = {}) {
  const platformKey = resolvePlatformKey(runtime);
  const info = PLATFORMS[platformKey];
  if (!info) {
    throw new Error(`unsupported agenter CLI target: ${platformKey}. Supported: ${SUPPORTED_PLATFORM_KEYS.join(", ")}`);
  }
  return { ...info, platformKey };
}

function resolvePackageBinaryPath(packageRoot, runtime = {}, resolvePackageJsonPath = require.resolve) {
  const info = resolvePlatformInfo(runtime);
  const packageJsonPath = resolvePackageJsonPath(`${info.pkg}/package.json`);
  const packageDir = path.dirname(packageJsonPath);
  return {
    ...info,
    packageDir,
    binaryPath: path.join(packageDir, "bin", info.bin),
    publicBinPath: path.join(packageRoot, PUBLIC_BIN_PATH),
  };
}

module.exports = {
  BINARY_NAME,
  PACKAGE_NAME_PREFIX,
  PACKAGE_PREFIX,
  PLATFORMS,
  PUBLIC_BIN_PATH,
  SUPPORTED_PLATFORM_KEYS,
  detectLinuxLibc,
  resolvePackageBinaryPath,
  resolvePlatformInfo,
  resolvePlatformKey,
};
