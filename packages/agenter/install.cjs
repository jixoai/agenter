#!/usr/bin/env node

const { chmodSync, copyFileSync, mkdirSync } = require("fs");
const path = require("path");

const {
  PACKAGE_NAME_PREFIX,
  resolvePlatformInfo,
  resolvePackageBinaryPath,
  SUPPORTED_PLATFORM_KEYS,
} = require("./native-platform.cjs");

function listAvailableTargets(optionalDependencies) {
  return Object.keys(optionalDependencies)
    .filter((name) => name.startsWith(PACKAGE_NAME_PREFIX))
    .map((name) => name.replace(PACKAGE_NAME_PREFIX, ""))
    .sort();
}

function placeBinary(src, dest, platform = process.platform) {
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  if (platform !== "win32") {
    chmodSync(dest, 0o755);
  }
}

function installNativeBinary(options = {}) {
  const packageRoot = options.packageRoot ?? __dirname;
  const packageJson = options.packageJson ?? require("./package.json");
  const optionalDependencies = packageJson.optionalDependencies ?? {};
  const log = options.log ?? ((line) => console.error(line));
  let platformInfo;

  try {
    platformInfo = resolvePlatformInfo(options.runtime);
  } catch (error) {
    log(`[${packageJson.name} postinstall] ${error instanceof Error ? error.message : String(error)}`);
    return { placed: false, reason: "unsupported-platform" };
  }

  if (!optionalDependencies[platformInfo.pkg]) {
    const availableTargets = listAvailableTargets(optionalDependencies);
    log(
      `[${packageJson.name} postinstall] Native binaries for ${platformInfo.platformKey} are not available on this release channel.`,
    );
    log(`  Available: ${(availableTargets.length > 0 ? availableTargets : SUPPORTED_PLATFORM_KEYS).join(", ")}`);
    return { placed: false, reason: "release-channel-missing" };
  }

  let resolution;
  try {
    resolution = resolvePackageBinaryPath(
      packageRoot,
      options.runtime,
      options.resolvePackageJsonPath ?? require.resolve,
    );
    placeBinary(resolution.binaryPath, resolution.publicBinPath, options.runtime?.platform ?? process.platform);
    return { placed: true, resolution };
  } catch (error) {
    log(
      `[${packageJson.name} postinstall] Failed to place ${platformInfo.pkg}: ${error instanceof Error ? error.message : String(error)}`,
    );
    log(`  Fallback: node ${path.join(packageRoot, "cli-wrapper.cjs")}`);
    return { placed: false, reason: "placement-failed", resolution };
  }
}

function main() {
  installNativeBinary();
}

module.exports = {
  installNativeBinary,
  listAvailableTargets,
  main,
  placeBinary,
};

if (require.main === module) {
  main();
}
