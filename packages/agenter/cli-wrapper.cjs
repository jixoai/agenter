#!/usr/bin/env node

const { spawnSync } = require("child_process");
const { constants } = require("os");
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

function resolveWrapperBinary(options = {}) {
  const packageRoot = options.packageRoot ?? __dirname;
  const packageJson = options.packageJson ?? require("./package.json");
  const platformInfo = resolvePlatformInfo(options.runtime);
  const optionalDependencies = packageJson.optionalDependencies ?? {};
  if (!optionalDependencies[platformInfo.pkg]) {
    const availableTargets = listAvailableTargets(optionalDependencies);
    throw new Error(
      `native binary ${platformInfo.pkg} is not published by this wrapper release. ` +
        `Available targets: ${(availableTargets.length > 0 ? availableTargets : SUPPORTED_PLATFORM_KEYS).join(", ")}`,
    );
  }
  try {
    return resolvePackageBinaryPath(packageRoot, options.runtime, options.resolvePackageJsonPath ?? require.resolve);
  } catch (error) {
    throw new Error(
      `could not resolve native binary package ${platformInfo.pkg}: ${error instanceof Error ? error.message : String(error)}. ` +
        `Fallback: node ${path.join(packageRoot, "cli-wrapper.cjs")}`,
    );
  }
}

function spawnWrapperBinary(options = {}) {
  const resolution = resolveWrapperBinary(options);
  const result = (options.spawnSyncImpl ?? spawnSync)(resolution.binaryPath, options.argv ?? process.argv.slice(2), {
    stdio: "inherit",
    env: {
      ...process.env,
      ...options.env,
    },
  });
  if (result.error) {
    throw new Error(`failed to execute native agenter binary at ${resolution.binaryPath}: ${result.error.message}`);
  }
  return result;
}

function main() {
  try {
    const result = spawnWrapperBinary();
    if (result.signal) {
      const signum = constants.signals[result.signal] ?? 0;
      process.exit(128 + signum);
    }
    process.exit(result.status ?? 1);
  } catch (error) {
    console.error(`[agenter] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

module.exports = {
  listAvailableTargets,
  main,
  resolveWrapperBinary,
  spawnWrapperBinary,
};

if (require.main === module) {
  main();
}
