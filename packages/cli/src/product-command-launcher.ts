import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { type ProductCommandDescriptor, type ProductSource } from "@agenter/product-extension-runtime";
import yargs from "yargs";

import { resolveProductCommandDescriptor } from "./product-command-registry";

const BUN_BIN = Bun.which("bun") ?? process.execPath;
const DEFAULT_PRODUCT_PACKAGE_RUNNER = "bunx";

const builtInCommands = new Set(["auth-service", "profile-service", "daemon", "web", "tui", "doctor", "help"]);

interface PackageJsonShape {
  name?: string;
  bin?: string | Record<string, string>;
}

interface LauncherRoutingParseResult {
  host: string;
  port: number;
  authServiceEndpoint?: string;
  authServiceDataDir?: string;
  authServiceHost?: string;
  authServicePort?: number;
  _: Array<string | number>;
  "--"?: string[];
}

export interface ProductLauncherOptions {
  host: string;
  port: number;
  authServiceEndpoint?: string;
  authServiceDataDir?: string;
  authServiceHost?: string;
  authServicePort?: number;
}

export interface ProductCommandInvocation {
  descriptor: ProductCommandDescriptor;
  productArgv: string[];
  launcherOptions: ProductLauncherOptions;
}

export interface LocalProductLaunchTarget {
  source: "workspace" | "installed";
  packageDir: string;
  packageJsonPath: string;
  binPath: string;
}

export interface RemoteProductLaunchTarget {
  source: "remote";
  packageName: string;
  binName: string;
}

export type ProductLaunchTarget = LocalProductLaunchTarget | RemoteProductLaunchTarget;

export interface ProductLaunchEnvInput {
  baseEnv?: NodeJS.ProcessEnv;
  descriptor: ProductCommandDescriptor;
  source: ProductSource;
  launcherOptions: ProductLauncherOptions;
}

export interface ProductCommandTargetResolverOptions {
  cliSourceDir: string;
  resolveInstalledPackageJsonPath?: (packageName: string) => string;
}

const readPackageJson = (packageJsonPath: string): PackageJsonShape =>
  JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJsonShape;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const resolveLauncherRouting = (
  args: readonly string[],
): ProductLauncherOptions & { positionals: string[]; doubleDash: string[] } => {
  const parsed = yargs([...args])
    .parserConfiguration({ "unknown-options-as-args": true, "populate--": true })
    .option("host", {
      type: "string",
      default: "127.0.0.1",
    })
    .option("port", {
      type: "number",
      default: 4580,
    })
    .option("auth-service-endpoint", {
      type: "string",
    })
    .option("auth-service-data-dir", {
      type: "string",
    })
    .option("auth-service-host", {
      type: "string",
    })
    .option("auth-service-port", {
      type: "number",
    })
    .exitProcess(false)
    .help(false)
    .version(false)
    .parseSync() as LauncherRoutingParseResult;

  return {
    host: String(parsed.host),
    port: Number(parsed.port),
    authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
    authServiceDataDir: typeof parsed.authServiceDataDir === "string" ? parsed.authServiceDataDir : undefined,
    authServiceHost: typeof parsed.authServiceHost === "string" ? parsed.authServiceHost : undefined,
    authServicePort: typeof parsed.authServicePort === "number" ? parsed.authServicePort : undefined,
    positionals: parsed._.map(String),
    doubleDash: readStringArray(parsed["--"]),
  };
};

const resolvePackageBinRelativePath = (input: {
  descriptor: ProductCommandDescriptor;
  packageJsonPath: string;
  packageJson: PackageJsonShape;
}): string => {
  if (input.descriptor.bin.path?.trim()) {
    return input.descriptor.bin.path.trim();
  }
  if (typeof input.packageJson.bin === "string") {
    return input.packageJson.bin;
  }
  const keyed = input.packageJson.bin?.[input.descriptor.bin.name];
  if (typeof keyed === "string" && keyed.trim().length > 0) {
    return keyed;
  }
  throw new Error(
    `package ${input.descriptor.packageName} does not expose bin ${input.descriptor.bin.name} in ${input.packageJsonPath}`,
  );
};

const resolveWorkspacePackageDir = (cliSourceDir: string, packageName: string): string => {
  const packageSegment = packageName.split("/")[1];
  if (!packageSegment) {
    throw new Error(`invalid scoped package name: ${packageName}`);
  }
  return resolve(cliSourceDir, "../../", packageSegment);
};

const tryResolveWorkspaceTarget = (
  descriptor: ProductCommandDescriptor,
  cliSourceDir: string,
): LocalProductLaunchTarget | null => {
  const packageDir = resolveWorkspacePackageDir(cliSourceDir, descriptor.packageName);
  const packageJsonPath = join(packageDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  const packageJson = readPackageJson(packageJsonPath);
  if (packageJson.name !== descriptor.packageName) {
    return null;
  }
  const binRelativePath = resolvePackageBinRelativePath({
    descriptor,
    packageJsonPath,
    packageJson,
  });
  return {
    source: "workspace",
    packageDir,
    packageJsonPath,
    binPath: resolve(packageDir, binRelativePath),
  };
};

const defaultResolveInstalledPackageJsonPath = (packageName: string): string =>
  createRequire(import.meta.url).resolve(`${packageName}/package.json`);

const tryResolveInstalledTarget = (
  descriptor: ProductCommandDescriptor,
  resolveInstalledPackageJsonPath: (packageName: string) => string,
): LocalProductLaunchTarget | null => {
  try {
    const packageJsonPath = resolveInstalledPackageJsonPath(descriptor.packageName);
    const packageJson = readPackageJson(packageJsonPath);
    const binRelativePath = resolvePackageBinRelativePath({
      descriptor,
      packageJsonPath,
      packageJson,
    });
    return {
      source: "installed",
      packageDir: dirname(packageJsonPath),
      packageJsonPath,
      binPath: resolve(dirname(packageJsonPath), binRelativePath),
    };
  } catch {
    return null;
  }
};

export const resolveProductCommandInvocation = (args: readonly string[]): ProductCommandInvocation | null => {
  const routed = resolveLauncherRouting(args);
  const command = routed.positionals[0];
  if (!command) {
    return null;
  }
  const descriptor = resolveProductCommandDescriptor(command);
  if (!descriptor) {
    return null;
  }
  return {
    descriptor,
    productArgv: [
      ...routed.positionals.slice(1),
      ...(routed.doubleDash.length > 0 ? ["--", ...routed.doubleDash] : []),
    ],
    launcherOptions: {
      host: routed.host,
      port: routed.port,
      authServiceEndpoint: routed.authServiceEndpoint,
      authServiceDataDir: routed.authServiceDataDir,
      authServiceHost: routed.authServiceHost,
      authServicePort: routed.authServicePort,
    },
  };
};

export const readCommandToken = (args: readonly string[]): string | null => resolveLauncherRouting(args).positionals[0] ?? null;

export const isBuiltInCommand = (command: string): boolean => builtInCommands.has(command);

export const resolveProductLaunchTarget = (
  descriptor: ProductCommandDescriptor,
  options: ProductCommandTargetResolverOptions,
): ProductLaunchTarget => {
  const resolveInstalledPackageJsonPath = options.resolveInstalledPackageJsonPath ?? defaultResolveInstalledPackageJsonPath;
  for (const source of descriptor.sourcePolicy.resolutionOrder) {
    if (source === "workspace" && descriptor.sourcePolicy.allowWorkspace) {
      const target = tryResolveWorkspaceTarget(descriptor, options.cliSourceDir);
      if (target) {
        return target;
      }
    }
    if (source === "installed" && descriptor.sourcePolicy.allowInstalled) {
      const target = tryResolveInstalledTarget(descriptor, resolveInstalledPackageJsonPath);
      if (target) {
        return target;
      }
    }
    if (source === "remote" && descriptor.sourcePolicy.allowRemote) {
      return {
        source: "remote",
        packageName: descriptor.packageName,
        binName: descriptor.bin.name,
      };
    }
  }
  throw new Error(`no launch target available for ${descriptor.command} -> ${descriptor.packageName}`);
};

export const buildProductLaunchEnv = (input: ProductLaunchEnvInput): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    ...(input.baseEnv ?? process.env),
    AGENTER_DAEMON_HOST: input.launcherOptions.host,
    AGENTER_DAEMON_PORT: String(input.launcherOptions.port),
    AGENTER_PRODUCT_COMMAND: input.descriptor.command,
    AGENTER_PRODUCT_PACKAGE: input.descriptor.packageName,
    AGENTER_PRODUCT_SOURCE: input.source,
  };
  if (input.launcherOptions.authServiceEndpoint?.trim()) {
    env.AGENTER_AUTH_SERVICE_ENDPOINT = input.launcherOptions.authServiceEndpoint.trim();
  } else {
    delete env.AGENTER_AUTH_SERVICE_ENDPOINT;
  }
  return env;
};

export const resolveProductPackageRunner = (env: NodeJS.ProcessEnv = process.env): string =>
  env.AGENTER_PRODUCT_PACKAGE_RUNNER?.trim() || DEFAULT_PRODUCT_PACKAGE_RUNNER;

export const buildProductProcessCommand = (
  target: ProductLaunchTarget,
  descriptor: ProductCommandDescriptor,
  productArgv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): string[] => {
  if (target.source !== "remote") {
    return [BUN_BIN, "run", target.binPath, ...productArgv];
  }
  return [
    resolveProductPackageRunner(env),
    "--package",
    target.packageName,
    descriptor.bin.name,
    ...productArgv,
  ];
};
