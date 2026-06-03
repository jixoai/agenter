import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { type AppCommandDescriptor, type AppSource } from "@agenter/app-runtime";
import yargs from "yargs";

import { listAppCommandDescriptors, resolveAppCommandDescriptor } from "./app-command-registry";

const BUN_BIN = Bun.which("bun") ?? process.execPath;
const DEFAULT_APP_PACKAGE_RUNNER = "bunx";
const metadataOnlyTokens = new Set(["--help", "-h", "help", "--version", "-v", "version"]);

const builtInCommands = new Set(["auth-service", "profile-service", "daemon", "doctor", "help"]);

interface PackageJsonShape {
  name?: string;
  bin?: string | Record<string, string>;
  peerDependencies?: Record<string, string>;
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

export interface AppLauncherOptions {
  host: string;
  port: number;
  authServiceEndpoint?: string;
  authServiceDataDir?: string;
  authServiceHost?: string;
  authServicePort?: number;
}

export interface AppCommandInvocation {
  descriptor: AppCommandDescriptor;
  appArgv: string[];
  launcherOptions: AppLauncherOptions;
}

export interface LocalAppLaunchTarget {
  source: "workspace" | "installed";
  packageDir: string;
  packageJsonPath: string;
  binPath: string;
  mainPath: string;
}

export interface RemoteAppLaunchTarget {
  source: "remote";
  packageName: string;
  packageVersion?: string;
  binName: string;
}

export type AppLaunchTarget = LocalAppLaunchTarget | RemoteAppLaunchTarget;

export interface AppLaunchEnvInput {
  baseEnv?: NodeJS.ProcessEnv;
  descriptor: AppCommandDescriptor;
  source: AppSource;
  launcherOptions: AppLauncherOptions;
}

export interface AppCommandTargetResolverOptions {
  cliSourceDir: string;
  resolveInstalledPackageJsonPath?: (packageName: string) => string;
  resolveRemotePackageVersionCandidates?: (
    packageName: string,
    descriptor: AppCommandDescriptor,
  ) => readonly AppPackageVersionCandidate[];
  hostVersion?: string;
  workspaceAppRoots?: readonly string[];
}

export interface AppPackageVersionCandidate {
  version: string;
  peerDependencies?: Record<string, string>;
  discovery?: {
    keywords?: readonly string[];
    catalogSource?: string;
  };
}

const readPackageJson = (packageJsonPath: string): PackageJsonShape =>
  JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJsonShape;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const resolveLauncherRouting = (
  args: readonly string[],
): AppLauncherOptions & { positionals: string[]; doubleDash: string[] } => {
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
  descriptor: AppCommandDescriptor;
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

const parseVersion = (version: string): [number, number, number] | null => {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/u);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

const compareVersions = (left: string, right: string): number => {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) {
    return left.localeCompare(right);
  }
  for (let index = 0; index < leftParts.length; index += 1) {
    const diff = leftParts[index] - rightParts[index];
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

const isSameMajorMinor = (hostVersion: string, prefixVersion: string): boolean => {
  const host = parseVersion(hostVersion);
  const prefix = parseVersion(prefixVersion);
  return Boolean(host && prefix && host[0] === prefix[0] && host[1] === prefix[1]);
};

const versionSatisfiesComparator = (hostVersion: string, comparator: string): boolean => {
  const trimmed = comparator.trim();
  const match = trimmed.match(/^(>=|>|<=|<|=)?\s*(\d+\.\d+\.\d+)$/u);
  if (!match) {
    return false;
  }
  const operator = match[1] ?? "=";
  const diff = compareVersions(hostVersion, match[2]);
  if (operator === ">=") return diff >= 0;
  if (operator === ">") return diff > 0;
  if (operator === "<=") return diff <= 0;
  if (operator === "<") return diff < 0;
  return diff === 0;
};

const versionSatisfiesRange = (hostVersion: string, range: string): boolean => {
  const trimmed = range.trim();
  if (trimmed === "*" || trimmed === "") {
    return true;
  }
  const wildcard = trimmed.match(/^(\d+)\.(\d+)\.\*$/u);
  if (wildcard) {
    return isSameMajorMinor(hostVersion, `${wildcard[1]}.${wildcard[2]}.0`);
  }
  const caret = trimmed.match(/^\^(\d+)\.(\d+)\.(\d+)$/u);
  if (caret) {
    const [, major, minor, patch] = caret;
    if (major === "0" && minor === "0") {
      return (
        versionSatisfiesComparator(hostVersion, `>=${major}.${minor}.${patch}`) &&
        versionSatisfiesComparator(hostVersion, `<${major}.${minor}.${Number(patch) + 1}`)
      );
    }
    if (major === "0") {
      return (
        versionSatisfiesComparator(hostVersion, `>=${major}.${minor}.${patch}`) &&
        versionSatisfiesComparator(hostVersion, `<${major}.${Number(minor) + 1}.0`)
      );
    }
    return (
      versionSatisfiesComparator(hostVersion, `>=${major}.${minor}.${patch}`) &&
      versionSatisfiesComparator(hostVersion, `<${Number(major) + 1}.0.0`)
    );
  }
  return trimmed.split(/\s+/u).every((comparator) => versionSatisfiesComparator(hostVersion, comparator));
};

export const selectCompatibleAppPackageVersion = (input: {
  hostVersion: string;
  candidates: readonly AppPackageVersionCandidate[];
}): string | null => {
  const compatible = input.candidates.filter((candidate) => {
    const range = candidate.peerDependencies?.agenter;
    return typeof range === "string" && versionSatisfiesRange(input.hostVersion, range);
  });
  compatible.sort((left, right) => compareVersions(right.version, left.version));
  return compatible[0]?.version ?? null;
};

const resolveRemotePackageVersion = (
  descriptor: AppCommandDescriptor,
  options: AppCommandTargetResolverOptions,
): string | undefined => {
  // Catalogs only discover candidates; peerDependencies.agenter is the compatibility authority.
  const candidates = options.resolveRemotePackageVersionCandidates?.(descriptor.packageName, descriptor) ?? [];
  if (candidates.length === 0) {
    return undefined;
  }
  if (!options.hostVersion?.trim()) {
    throw new Error(`host version is required to select compatible app package ${descriptor.packageName}`);
  }
  const version = selectCompatibleAppPackageVersion({
    hostVersion: options.hostVersion,
    candidates,
  });
  if (!version) {
    throw new Error(`no compatible ${descriptor.packageName} version for agenter@${options.hostVersion}`);
  }
  return version;
};

const resolveWorkspaceAppRoots = (
  cliSourceDir: string,
  configuredRoots?: readonly string[],
): readonly string[] => {
  if (configuredRoots && configuredRoots.length > 0) {
    return configuredRoots.map((root) => resolve(root));
  }
  const repoRoot = resolve(cliSourceDir, "../../..");
  return [resolve(repoRoot, "apps"), resolve(repoRoot, "packages")];
};

const resolveWorkspacePackageDirs = (
  cliSourceDir: string,
  _packageName: string,
  configuredRoots?: readonly string[],
): readonly string[] => {
  const packageDirs: string[] = [];
  for (const root of resolveWorkspaceAppRoots(cliSourceDir, configuredRoots)) {
    if (!existsSync(root)) {
      continue;
    }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        packageDirs.push(resolve(root, entry.name));
      }
    }
  }
  return packageDirs;
};

const tryResolveWorkspaceTarget = (
  descriptor: AppCommandDescriptor,
  cliSourceDir: string,
  workspaceAppRoots?: readonly string[],
): LocalAppLaunchTarget | null => {
  for (const packageDir of resolveWorkspacePackageDirs(cliSourceDir, descriptor.packageName, workspaceAppRoots)) {
    const packageJsonPath = join(packageDir, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    const packageJson = readPackageJson(packageJsonPath);
    if (packageJson.name !== descriptor.packageName) {
      continue;
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
      mainPath: resolve(packageDir, "src", "index.ts"),
    };
  }
  return null;
};

const defaultResolveInstalledPackageJsonPath = (packageName: string): string =>
  createRequire(import.meta.url).resolve(`${packageName}/package.json`);

const tryResolveInstalledTarget = (
  descriptor: AppCommandDescriptor,
  resolveInstalledPackageJsonPath: (packageName: string) => string,
): LocalAppLaunchTarget | null => {
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
      mainPath: resolve(dirname(packageJsonPath), "src", "index.ts"),
    };
  } catch {
    return null;
  }
};

export const resolveAppCommandInvocation = (args: readonly string[]): AppCommandInvocation | null => {
  const routed = resolveLauncherRouting(args);
  const command = routed.positionals[0];
  if (!command) {
    return null;
  }
  const descriptor = resolveAppCommandDescriptor(command);
  if (!descriptor) {
    return null;
  }
  return {
    descriptor,
    appArgv: [
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

export const isLauncherMetadataOnlyCommand = (command: string): boolean => metadataOnlyTokens.has(command);

export const resolveAppLaunchTarget = (
  descriptor: AppCommandDescriptor,
  options: AppCommandTargetResolverOptions,
): AppLaunchTarget => {
  const resolveInstalledPackageJsonPath = options.resolveInstalledPackageJsonPath ?? defaultResolveInstalledPackageJsonPath;
  for (const source of descriptor.sourcePolicy.resolutionOrder) {
    if (source === "workspace" && descriptor.sourcePolicy.allowWorkspace) {
      const target = tryResolveWorkspaceTarget(descriptor, options.cliSourceDir, options.workspaceAppRoots);
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
        packageVersion: resolveRemotePackageVersion(descriptor, options),
        binName: descriptor.bin.name,
      };
    }
  }
  throw new Error(`no launch target available for ${descriptor.command} -> ${descriptor.packageName}`);
};

export const buildAppLaunchEnv = (input: AppLaunchEnvInput): NodeJS.ProcessEnv => {
  const baseEnv = input.baseEnv ?? process.env;
  const bypassHosts = new Set(
    [
      baseEnv.NO_PROXY,
      baseEnv.no_proxy,
      "localhost",
      "127.0.0.1",
      "::1",
      input.launcherOptions.host,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
  const noProxy = [...bypassHosts].join(",");
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    AGENTER_DAEMON_HOST: input.launcherOptions.host,
    AGENTER_DAEMON_PORT: String(input.launcherOptions.port),
    AGENTER_APP_COMMAND: input.descriptor.command,
    AGENTER_APP_PACKAGE: input.descriptor.packageName,
    AGENTER_APP_SOURCE: input.source,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
  };
  if (input.launcherOptions.authServiceEndpoint?.trim()) {
    env.AGENTER_AUTH_SERVICE_ENDPOINT = input.launcherOptions.authServiceEndpoint.trim();
  } else {
    delete env.AGENTER_AUTH_SERVICE_ENDPOINT;
  }
  return env;
};

export const resolveAppPackageRunner = (env: NodeJS.ProcessEnv = process.env): string =>
  env.AGENTER_APP_PACKAGE_RUNNER?.trim() || DEFAULT_APP_PACKAGE_RUNNER;

export const isAppMetadataOnlyArgv = (appArgv: readonly string[]): boolean =>
  appArgv.some((token) => metadataOnlyTokens.has(token));

export const applyAppCommandsToYargs = <TBuilder extends ReturnType<typeof yargs>>(builder: TBuilder): TBuilder => {
  let next = builder;
  for (const descriptor of listAppCommandDescriptors()) {
    next = next.command(
      descriptor.command,
      descriptor.description ?? `run ${descriptor.appId}`,
      (commandBuilder) => commandBuilder,
      () => {
        // App commands are routed before yargs command execution.
      },
    ) as TBuilder;
  }
  return next;
};

export const buildAppProcessCommand = (
  target: AppLaunchTarget,
  descriptor: AppCommandDescriptor,
  appArgv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): string[] => {
  if (target.source !== "remote") {
    return [BUN_BIN, "run", target.binPath, ...appArgv];
  }
  const packageSpecifier = target.packageVersion
    ? `${target.packageName}@${target.packageVersion}`
    : target.packageName;
  return [
    resolveAppPackageRunner(env),
    "--package",
    packageSpecifier,
    descriptor.bin.name,
    ...appArgv,
  ];
};
