import type { AuthServiceBridgeOptions } from "@agenter/app-server";
import { resolveBundledAssetPath } from "@agenter/app-runtime";
import type { AuthServiceHandle } from "@agenter/auth-service";
import { spawn as spawnChildProcess } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { launcherPackageIdentity, packageLauncherIdentity, publicReleaseIdentity } from "./public-release-identity" with { type: "macro" };
import {
  clearOwnedDaemonRuntimeDescriptor,
  compatibleDaemonLauncherIdentity,
  normalizeDaemonHealthPayload,
  readDaemonRuntimeDescriptor,
  resolveDaemonLogPath,
  type DaemonHealthPayload,
  type DaemonLauncherIdentity,
  type DaemonRuntimeDescriptor,
} from "./daemon-runtime-descriptor";
import {
  resolveCurrentLauncherEntrypoint,
  resolveCurrentLauncherSourceKind,
  resolveCurrentSelfExec,
} from "./self-exec";
import {
  applyAppCommandsToYargs,
  buildAppLaunchEnv,
  buildAppProcessCommand,
  isBuiltInCommand,
  isAppMetadataOnlyArgv,
  isLauncherMetadataOnlyCommand,
  readCommandToken,
  resolveAppCommandInvocation,
  resolveAppLaunchTarget,
  type LocalAppLaunchTarget,
} from "./app-command-launcher";
import type { TrpcServerHandle } from "./trpc-server";

interface CommonArgs {
  host: string;
  port: number;
}

interface ResolvedDaemonAuthority extends CommonArgs {
  authServiceEndpoint?: string;
}

interface AuthServiceBridgeCliArgs {
  authServiceEndpoint?: string;
  authServiceDataDir?: string;
  authServiceHost?: string;
  authServicePort?: number;
}

interface StandaloneAuthServiceCliArgs extends CommonArgs {
  dataDir?: string;
}

type DaemonCommandAction = "start" | "stop" | "restart";

const INTERNAL_DAEMON_FOREGROUND_ENV = "AGENTER_INTERNAL_DAEMON_FOREGROUND";
const HEALTH_REQUEST_TIMEOUT_MS = 5_000;
const MANAGED_DAEMON_START_TIMEOUT_MS = 60_000;
const MANAGED_DAEMON_START_HEALTH_REQUEST_TIMEOUT_MS = 1_000;
const cliPublicReleaseIdentity = publicReleaseIdentity() as { name?: string; version?: string };
const cliLauncherPackageIdentity = launcherPackageIdentity() as { name?: string; version?: string };
const cliPackageLauncherIdentity = packageLauncherIdentity() as { name?: string; version?: string };

interface DaemonCompatibilityMismatch {
  expected: DaemonLauncherIdentity;
  actual: DaemonLauncherIdentity | null;
  endpoint: string;
}

class DaemonCompatibilityError extends Error {
  constructor(readonly mismatch: DaemonCompatibilityMismatch) {
    super(formatDaemonCompatibilityMessage(mismatch));
  }
}

type DaemonHealthProbe = { reachable: false } | { reachable: true; payload: DaemonHealthPayload | null };

type StopManagedDaemonResult =
  | { kind: "missing" }
  | { kind: "stale"; descriptor: DaemonRuntimeDescriptor }
  | { kind: "foreign"; descriptor: DaemonRuntimeDescriptor }
  | { kind: "stopped"; descriptor: DaemonRuntimeDescriptor }
  | { kind: "timeout"; descriptor: DaemonRuntimeDescriptor };

const waitForSignal = async (cleanup?: () => Promise<void> | void): Promise<void> => {
  await new Promise<void>((resolve) => {
    const onSignal = async (): Promise<void> => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      try {
        await cleanup?.();
      } finally {
        resolve();
      }
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });
};

const healthUrl = (args: CommonArgs): string => `http://${args.host}:${args.port}/health`;
const resolveLauncherHomeDir = (): string => process.env.HOME || homedir();
const resolveLauncherOwnedAuthServiceDataDir = (): string =>
  join(resolveLauncherHomeDir(), ".agenter", "launcher-auth-service");
const resolveDaemonHealthLabel = (args: CommonArgs): string => `http://${args.host}:${args.port}/health`;
const resolveCliEntryPath = (): string => resolve(import.meta.dir, "bin", "agenter.ts");
const resolveCurrentLauncherIdentity = (): DaemonLauncherIdentity => {
  const entrypoint = resolveCurrentLauncherEntrypoint({
    argv: process.argv,
    execPath: process.execPath,
    importMetaUrl: import.meta.url,
    cliEntryPath: resolveCliEntryPath(),
  });
  const sourceKind = resolveCurrentLauncherSourceKind(entrypoint, {
    importMetaUrl: import.meta.url,
  });
  const packageIdentity =
    sourceKind === "package"
      ? {
          packageName: cliPackageLauncherIdentity.name ?? "agenter",
          packageVersion: cliPackageLauncherIdentity.version ?? "unknown",
        }
      : {
          packageName: cliLauncherPackageIdentity.name ?? "@agenter/cli",
          packageVersion: cliLauncherPackageIdentity.version ?? "unknown",
        };
  return {
    packageName: packageIdentity.packageName,
    packageVersion: packageIdentity.packageVersion,
    sourceKind,
    entrypoint:
      sourceKind === "package"
        ? `${packageIdentity.packageName}@${packageIdentity.packageVersion}`
        : entrypoint,
  };
};

const fetchDaemonHealthProbe = async (
  urlString: string,
  timeoutMs = HEALTH_REQUEST_TIMEOUT_MS,
): Promise<DaemonHealthProbe> => {
  const url = new URL(urlString);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return await new Promise<DaemonHealthProbe>((resolve) => {
    const req = request(
      url,
      {
        method: "GET",
        timeout: timeoutMs,
      },
      (response) => {
        const chunks: Uint8Array[] = [];
        response.on("data", (chunk) => {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        response.on("end", () => {
          if (response.statusCode === undefined || response.statusCode < 200 || response.statusCode >= 300) {
            resolve({ reachable: false });
            return;
          }
          try {
            resolve({
              reachable: true,
              payload: normalizeDaemonHealthPayload(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown),
            });
          } catch {
            resolve({ reachable: true, payload: null });
          }
        });
      },
    );
    req.on("error", () => resolve({ reachable: false }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ reachable: false });
    });
    req.end();
  });
};

const isHttpHealthAlive = async (urlString: string, timeoutMs = HEALTH_REQUEST_TIMEOUT_MS): Promise<boolean> =>
  await new Promise<boolean>((resolve) => {
    const url = new URL(urlString);
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(
      url,
      {
        method: "GET",
        timeout: timeoutMs,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 300);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });

const isDaemonAlive = async (args: CommonArgs, timeoutMs?: number): Promise<boolean> =>
  await isHttpHealthAlive(healthUrl(args), timeoutMs);

const isReusableDaemonDescriptorHealthy = async (descriptor: DaemonRuntimeDescriptor): Promise<boolean> =>
  await isHttpHealthAlive(`${descriptor.endpoint.replace(/\/$/u, "")}/health`);

const assertCompatibleDaemonHealth = async (
  authority: CommonArgs,
  expected: DaemonLauncherIdentity,
): Promise<ResolvedDaemonAuthority | null> => {
  const endpoint = `http://${authority.host}:${authority.port}`;
  const health = await fetchDaemonHealthProbe(`${endpoint}/health`);
  if (!health.reachable) {
    return null;
  }
  if (!health.payload) {
    throw new DaemonCompatibilityError({
      expected,
      actual: null,
      endpoint,
    });
  }
  if (!compatibleDaemonLauncherIdentity(expected, health.payload.launcher)) {
    throw new DaemonCompatibilityError({
      expected,
      actual: health.payload.launcher,
      endpoint,
    });
  }
  return {
    host: authority.host,
    port: authority.port,
  };
};

const assertCompatibleDaemonDescriptor = async (
  descriptor: DaemonRuntimeDescriptor,
  expected: DaemonLauncherIdentity,
): Promise<ResolvedDaemonAuthority | null> => {
  const health = await fetchDaemonHealthProbe(`${descriptor.endpoint.replace(/\/$/u, "")}/health`);
  if (!health.reachable) {
    return null;
  }
  if (!health.payload) {
    throw new DaemonCompatibilityError({
      expected,
      actual: null,
      endpoint: descriptor.endpoint,
    });
  }
  if (
    !compatibleDaemonLauncherIdentity(expected, descriptor.launcher) ||
    !compatibleDaemonLauncherIdentity(expected, health.payload.launcher)
  ) {
    throw new DaemonCompatibilityError({
      expected,
      actual: health.payload.launcher,
      endpoint: descriptor.endpoint,
    });
  }
  return {
    host: descriptor.host,
    port: descriptor.port,
  };
};

const formatDaemonCompatibilityMessage = (input: DaemonCompatibilityMismatch): string => {
  const actual = input.actual
    ? `${input.actual.packageName}@${input.actual.packageVersion} (${input.actual.sourceKind}, ${input.actual.entrypoint})`
    : "unknown daemon launcher";
  const expected = `${input.expected.packageName}@${input.expected.packageVersion} (${input.expected.sourceKind}, ${input.expected.entrypoint})`;
  return [
    `daemon at ${input.endpoint} was started by a different agenter launcher`,
    `expected: ${expected}`,
    `actual: ${actual}`,
    "run `agenter daemon restart` from the same agenter command you are using now, then retry",
  ].join("\n");
};

const waitFor = async (
  predicate: () => Promise<boolean> | boolean,
  timeoutMs: number,
  intervalMs = 100,
): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
};

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ESRCH") {
      return false;
    }
    if (code === "EPERM") {
      return true;
    }
    throw error;
  }
};

const sameDaemonAuthority = (
  descriptor: Pick<DaemonRuntimeDescriptor, "host" | "port">,
  requested: Pick<DaemonRuntimeDescriptor, "host" | "port">,
): boolean => descriptor.host === requested.host && descriptor.port === requested.port;

const resolveDaemonCommandAction = (value: unknown): DaemonCommandAction =>
  value === "stop" || value === "restart" ? value : "start";

const isForegroundDaemonServeRequested = (): boolean => process.env[INTERNAL_DAEMON_FOREGROUND_ENV] === "1";

const buildDaemonServeArgv = (args: CommonArgs & AuthServiceBridgeCliArgs): string[] => {
  const argv = ["daemon", "start", "--host", args.host, "--port", String(args.port)];
  if (args.authServiceEndpoint) {
    argv.push("--auth-service-endpoint", args.authServiceEndpoint);
  }
  if (args.authServiceDataDir) {
    argv.push("--auth-service-data-dir", args.authServiceDataDir);
  }
  if (args.authServiceHost) {
    argv.push("--auth-service-host", args.authServiceHost);
  }
  if (typeof args.authServicePort === "number") {
    argv.push("--auth-service-port", String(args.authServicePort));
  }
  return argv;
};

interface ManagedDaemonProcessSpawn {
  pid: number;
  logPath: string;
}

const readLogTail = (path: string, maxBytes = 16_384): string => {
  try {
    const text = readFileSync(path, "utf8");
    return text.length > maxBytes ? text.slice(-maxBytes) : text;
  } catch {
    return "";
  }
};

const spawnManagedDaemonProcess = (args: CommonArgs & AuthServiceBridgeCliArgs): ManagedDaemonProcessSpawn => {
  const logPath = resolveDaemonLogPath(resolveLauncherHomeDir(), args);
  mkdirSync(dirname(logPath), { recursive: true });
  const logFd = openSync(logPath, "a");
  const child = (() => {
    try {
      const selfExec = resolveCurrentSelfExec({
        argv: process.argv,
        bunExecutable: Bun.which("bun") ?? process.execPath,
        cliEntryPath: resolveCliEntryPath(),
        execPath: process.execPath,
        importMetaUrl: import.meta.url,
      });
      return spawnChildProcess(selfExec.command, [...selfExec.argvPrefix, ...buildDaemonServeArgv(args)], {
        cwd: process.cwd(),
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: {
          ...process.env,
          [INTERNAL_DAEMON_FOREGROUND_ENV]: "1",
        },
      });
    } finally {
      closeSync(logFd);
    }
  })();
  child.unref();
  if (typeof child.pid !== "number" || child.pid <= 0) {
    throw new Error("failed to spawn background daemon process");
  }
  return {
    pid: child.pid,
    logPath,
  };
};

const waitForManagedDaemonHealthy = async (
  authority: CommonArgs,
  pid: number,
  timeoutMs = MANAGED_DAEMON_START_TIMEOUT_MS,
): Promise<"healthy" | "exited" | "timeout"> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isDaemonAlive(authority, MANAGED_DAEMON_START_HEALTH_REQUEST_TIMEOUT_MS)) {
      return "healthy";
    }
    if (!isProcessAlive(pid)) {
      return "exited";
    }
    await new Promise((resolveNext) => setTimeout(resolveNext, 100));
  }
  return "timeout";
};

const stopManagedDaemonForHomeRoot = async (): Promise<StopManagedDaemonResult> => {
  const descriptor = readDaemonRuntimeDescriptor(resolveLauncherHomeDir());
  if (!descriptor) {
    return { kind: "missing" };
  }

  const processAlive = isProcessAlive(descriptor.pid);
  const healthAlive = await isReusableDaemonDescriptorHealthy(descriptor);
  if (!processAlive) {
    if (!healthAlive) {
      clearOwnedDaemonRuntimeDescriptor(descriptor);
      return { kind: "stale", descriptor };
    }
    return { kind: "foreign", descriptor };
  }

  process.kill(descriptor.pid, "SIGTERM");
  const stopped = await waitFor(
    async () => !isProcessAlive(descriptor.pid) && !(await isReusableDaemonDescriptorHealthy(descriptor)),
    15_000,
  );
  if (!stopped) {
    return { kind: "timeout", descriptor };
  }
  clearOwnedDaemonRuntimeDescriptor(descriptor);
  return { kind: "stopped", descriptor };
};

const runDaemonServeForeground = async (args: CommonArgs & AuthServiceBridgeCliArgs): Promise<void> => {
  const daemon = await startDaemon({
    host: args.host,
    port: args.port,
    authServiceEndpoint: args.authServiceEndpoint,
    authServiceDataDir: args.authServiceDataDir,
    authServiceHost: args.authServiceHost,
    authServicePort: args.authServicePort,
  });
  console.log(`agenter daemon listening on ${daemon.host}:${daemon.port}`);
  await waitForSignal(async () => {
    await daemon.stop();
  });
};

const runDaemonStartCommand = async (args: CommonArgs & AuthServiceBridgeCliArgs): Promise<void> => {
  const requested = {
    host: args.host,
    port: args.port,
  };
  const existing = readDaemonRuntimeDescriptor(resolveLauncherHomeDir());
  if (existing) {
    const existingHealthy = await isReusableDaemonDescriptorHealthy(existing);
    if (existingHealthy) {
      const expectedLauncherIdentity = resolveCurrentLauncherIdentity();
      if (!compatibleDaemonLauncherIdentity(expectedLauncherIdentity, existing.launcher)) {
        console.error(
          formatDaemonCompatibilityMessage({
            expected: expectedLauncherIdentity,
            actual: existing.launcher.sourceKind === "unknown" ? null : existing.launcher,
            endpoint: existing.endpoint,
          }),
        );
        process.exitCode = 1;
        return;
      }
      if (sameDaemonAuthority(existing, requested)) {
        console.log(`agenter daemon already running on ${existing.host}:${existing.port}`);
        return;
      }
      console.error(
        `daemon already running at ${existing.host}:${existing.port} for this home root; stop or restart it before starting ${requested.host}:${requested.port}`,
      );
      process.exitCode = 1;
      return;
    }
    if (!isProcessAlive(existing.pid)) {
      clearOwnedDaemonRuntimeDescriptor(existing);
    } else {
      console.error(
        `daemon process ${existing.pid} exists for this home root but is not healthy; use \`agenter daemon restart\` or \`agenter daemon stop\` first`,
      );
      process.exitCode = 1;
      return;
    }
  }

  const { pid, logPath } = spawnManagedDaemonProcess(args);
  const status = await waitForManagedDaemonHealthy(requested, pid);
  if (status === "healthy") {
    console.log(`agenter daemon started in background on ${requested.host}:${requested.port}`);
    console.log(`daemon log: ${logPath}`);
    return;
  }

  console.error(
    status === "exited"
      ? `background daemon process ${pid} exited before becoming healthy on ${requested.host}:${requested.port}`
      : `timed out waiting for background daemon ${pid} to become healthy on ${requested.host}:${requested.port}`,
  );
  console.error(`daemon log: ${logPath}`);
  const logTail = readLogTail(logPath).trim();
  if (logTail.length > 0) {
    console.error("daemon log tail:");
    console.error(logTail);
  }
  process.exitCode = 1;
};

const ensureManagedDaemonAuthority = async (
  args: CommonArgs & AuthServiceBridgeCliArgs,
  expected: DaemonLauncherIdentity,
): Promise<ResolvedDaemonAuthority> => {
  const requested = {
    host: args.host,
    port: args.port,
  };
  const existing = readDaemonRuntimeDescriptor(resolveLauncherHomeDir());
  if (existing) {
    const existingAuthority = await assertCompatibleDaemonDescriptor(existing, expected);
    if (existingAuthority) {
      return existingAuthority;
    }
    if (!isProcessAlive(existing.pid)) {
      clearOwnedDaemonRuntimeDescriptor(existing);
    } else {
      throw new Error(
        `daemon process ${existing.pid} exists for this home root but is not healthy; use \`agenter daemon restart\` or \`agenter daemon stop\` first`,
      );
    }
  }

  const { pid, logPath } = spawnManagedDaemonProcess(args);
  const status = await waitForManagedDaemonHealthy(requested, pid);
  if (status !== "healthy") {
    const reason =
      status === "exited"
        ? `background daemon process ${pid} exited before becoming healthy on ${requested.host}:${requested.port}`
        : `timed out waiting for background daemon ${pid} to become healthy on ${requested.host}:${requested.port}`;
    const logTail = readLogTail(logPath).trim();
    throw new Error(
      [reason, `daemon log: ${logPath}`, logTail.length > 0 ? `daemon log tail:\n${logTail}` : ""]
        .filter((line) => line.length > 0)
        .join("\n"),
    );
  }
  return {
    host: requested.host,
    port: requested.port,
  };
};

const runDaemonStopCommand = async (): Promise<void> => {
  const result = await stopManagedDaemonForHomeRoot();
  switch (result.kind) {
    case "missing":
      console.log("agenter daemon is not running for this home root");
      return;
    case "stale":
      console.log(`cleared stale daemon descriptor for ${result.descriptor.host}:${result.descriptor.port}`);
      return;
    case "foreign":
      console.error(
        `daemon descriptor points to a healthy server at ${result.descriptor.host}:${result.descriptor.port}, but pid ${result.descriptor.pid} is no longer alive`,
      );
      process.exitCode = 1;
      return;
    case "timeout":
      console.error(
        `timed out stopping daemon ${result.descriptor.pid} at ${result.descriptor.host}:${result.descriptor.port}`,
      );
      process.exitCode = 1;
      return;
    case "stopped":
      console.log(`stopped agenter daemon on ${result.descriptor.host}:${result.descriptor.port}`);
      return;
  }
};

const discoverCompatibleDaemonAuthority = async (
  expected: DaemonLauncherIdentity,
): Promise<ResolvedDaemonAuthority | null> => {
  const descriptor = readDaemonRuntimeDescriptor(resolveLauncherHomeDir());
  if (!descriptor) {
    return null;
  }
  return await assertCompatibleDaemonDescriptor(descriptor, expected);
};

const resolveAuthServiceBridgeOptions = (args: AuthServiceBridgeCliArgs): AuthServiceBridgeOptions | undefined => {
  const endpoint = args.authServiceEndpoint?.trim();
  const dataDir = args.authServiceDataDir?.trim();
  const host = args.authServiceHost?.trim();
  const port = args.authServicePort;
  if (!endpoint && !dataDir && !host && typeof port !== "number") {
    return undefined;
  }
  return {
    endpoint,
    dataDir,
    host,
    port,
  };
};

const resolveAppDaemonAuthServiceOptions = (args: AuthServiceBridgeCliArgs): AuthServiceBridgeCliArgs => {
  if (
    args.authServiceEndpoint?.trim() ||
    args.authServiceDataDir?.trim() ||
    args.authServiceHost?.trim() ||
    typeof args.authServicePort === "number"
  ) {
    return args;
  }
  return {
    ...args,
    authServiceDataDir: resolveLauncherOwnedAuthServiceDataDir(),
  };
};

const startDaemon = async (
  args: CommonArgs & AuthServiceBridgeCliArgs & { staticDir?: string; publicEnv?: Record<string, string> },
): Promise<TrpcServerHandle> => {
  const { startTrpcServer } = await import("./trpc-server");
  return await startTrpcServer({
    host: args.host,
    port: args.port,
    workspaceCwd: process.cwd(),
    staticDir: args.staticDir,
    publicEnv: args.publicEnv,
    homeDir: resolveLauncherHomeDir(),
    launcherIdentity: resolveCurrentLauncherIdentity(),
    authService: resolveAuthServiceBridgeOptions(args),
  });
};

const startStandaloneAuthService = async (args: StandaloneAuthServiceCliArgs): Promise<AuthServiceHandle> => {
  const { startAuthServiceServer } = await import("@agenter/auth-service");
  return await startAuthServiceServer({
    host: args.host,
    port: args.port,
    dataDir: args.dataDir,
    webauthnUiDir: resolveBundledAssetPath(["auth-service", "webauthn-ui"]),
  });
};

const withAuthServiceBridgeOptions = <TBuilder extends ReturnType<typeof yargs>>(builder: TBuilder): TBuilder =>
  builder
    .option("auth-service-endpoint", {
      type: "string",
      describe: "reuse an already-running standalone auth-service endpoint instead of spawning a local child service",
    })
    .option("auth-service-data-dir", {
      type: "string",
      describe: "override the managed-local auth-service data directory when the daemon owns the child service",
    })
    .option("auth-service-host", {
      type: "string",
      describe: "override the managed-local auth-service host when the daemon owns the child service",
    })
    .option("auth-service-port", {
      type: "number",
      describe: "override the managed-local auth-service port when the daemon owns the child service",
    }) as unknown as TBuilder;

export interface AppCommandLaunchDependencies {
  resolveDaemonAuthority(args: CommonArgs, expected: DaemonLauncherIdentity): Promise<ResolvedDaemonAuthority | null>;
  discoverReusableDaemonAuthority(expected: DaemonLauncherIdentity): Promise<ResolvedDaemonAuthority | null>;
  ensureManagedDaemonAuthority(
    args: CommonArgs & AuthServiceBridgeCliArgs,
    expected: DaemonLauncherIdentity,
  ): Promise<ResolvedDaemonAuthority>;
  spawnApp(input: {
    target: Parameters<typeof buildAppProcessCommand>[0];
    descriptor: Parameters<typeof buildAppProcessCommand>[1];
    appArgv: readonly string[];
    env: NodeJS.ProcessEnv;
  }): Bun.Subprocess<"inherit", "inherit", "inherit">;
}

const defaultAppCommandLaunchDependencies: AppCommandLaunchDependencies = {
  resolveDaemonAuthority: assertCompatibleDaemonHealth,
  discoverReusableDaemonAuthority: discoverCompatibleDaemonAuthority,
  ensureManagedDaemonAuthority: ensureManagedDaemonAuthority,
  spawnApp(input) {
    return Bun.spawn({
      cmd: buildAppProcessCommand(input.target, input.descriptor, input.appArgv, input.env),
      cwd: process.cwd(),
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: input.env,
    });
  },
};

const runLocalAppInProcess = async (input: {
  target: LocalAppLaunchTarget;
  mainExport: string;
  appArgv: readonly string[];
  env: NodeJS.ProcessEnv;
}): Promise<boolean> => {
  const previousEnv = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(input.env)) {
    previousEnv.set(key, process.env[key]);
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
  try {
    const mod = (await import(pathToFileURL(input.target.mainPath).href)) as Record<string, unknown>;
    const runner = mod[input.mainExport];
    if (typeof runner !== "function") {
      return false;
    }
    const argv = [process.argv[0] ?? "bun", input.target.binPath, ...input.appArgv];
    await (runner as (argv: string[]) => Promise<void> | void)(argv);
    return true;
  } finally {
    for (const [key, value] of previousEnv) {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  }
};

export const launchAppCommandForTest = async (
  argvInput: readonly string[],
  dependencies: AppCommandLaunchDependencies = defaultAppCommandLaunchDependencies,
): Promise<boolean> => {
  const routed = resolveAppCommandInvocation(argvInput);
  if (!routed) {
    const commandToken = readCommandToken(argvInput);
    if (commandToken && isLauncherMetadataOnlyCommand(commandToken)) {
      return false;
    }
    if (commandToken && !isBuiltInCommand(commandToken)) {
      console.error(`unsupported app command: ${commandToken}`);
      process.exitCode = 1;
      return true;
    }
    return false;
  }

  const target = resolveAppLaunchTarget(routed.descriptor, {
    cliSourceDir: import.meta.dir,
  });
  const common: CommonArgs = {
    host: routed.launcherOptions.host,
    port: routed.launcherOptions.port,
  };
  const needsRuntimeBootstrap =
    routed.descriptor.capabilityHints.requiresDaemon && !isAppMetadataOnlyArgv(routed.appArgv);
  const expectedLauncherIdentity = resolveCurrentLauncherIdentity();

  let resolvedDaemonAuthority: ResolvedDaemonAuthority = { ...common };
  if (needsRuntimeBootstrap) {
    const reusableAuthority = await dependencies.discoverReusableDaemonAuthority(expectedLauncherIdentity);
    if (reusableAuthority) {
      resolvedDaemonAuthority = reusableAuthority;
    } else {
      const daemonAuthority = await dependencies.resolveDaemonAuthority(common, expectedLauncherIdentity);
      if (daemonAuthority) {
        resolvedDaemonAuthority = daemonAuthority;
      } else {
        resolvedDaemonAuthority = await dependencies.ensureManagedDaemonAuthority(
          {
            ...common,
            ...resolveAppDaemonAuthServiceOptions({
              authServiceEndpoint: routed.launcherOptions.authServiceEndpoint,
              authServiceDataDir: routed.launcherOptions.authServiceDataDir,
              authServiceHost: routed.launcherOptions.authServiceHost,
              authServicePort: routed.launcherOptions.authServicePort,
            }),
          },
          expectedLauncherIdentity,
        );
      }
    }
  }

  const env = buildAppLaunchEnv({
    descriptor: routed.descriptor,
    source: target.source,
    launcherOptions: {
      ...routed.launcherOptions,
      host: resolvedDaemonAuthority.host,
      port: resolvedDaemonAuthority.port,
    },
  });
  if (target.source !== "remote" && routed.descriptor.bin.mainExport) {
    const handled = await runLocalAppInProcess({
      target,
      mainExport: routed.descriptor.bin.mainExport,
      appArgv: routed.appArgv,
      env,
    });
    if (handled) {
      return true;
    }
  }

  const child = dependencies.spawnApp({
    target,
    descriptor: routed.descriptor,
    appArgv: routed.appArgv,
    env,
  });

  const exitCode = await child.exited;
  process.exitCode = exitCode;

  return true;
};

const launchAppCommand = async (argvInput: readonly string[]): Promise<boolean> =>
  await launchAppCommandForTest(argvInput);

export const runCli = async (argvInput = process.argv): Promise<void> => {
  const rawArgs = hideBin(argvInput);
  try {
    if (await launchAppCommand(rawArgs)) {
      return;
    }
  } catch (error) {
    if (error instanceof DaemonCompatibilityError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  let argv: Awaited<ReturnType<ReturnType<typeof yargs>["parseAsync"]>>;
  try {
    argv = await applyAppCommandsToYargs(
      yargs(rawArgs)
        .scriptName("agenter")
        .version(cliPublicReleaseIdentity.version ?? "unknown")
        .option("host", {
          type: "string",
          default: "127.0.0.1",
          describe: "daemon host",
        })
        .option("port", {
          type: "number",
          default: 4580,
          describe: "daemon port",
        }),
    )
      .command(
        ["auth-service", "profile-service"],
        "start standalone auth-service (profile-service remains a deprecated compatibility alias)",
        (builder) =>
          builder
            .option("port", {
              type: "number",
              default: 4591,
              describe: "auth-service port",
            })
            .option("data-dir", {
              type: "string",
              describe: "auth-service data directory; defaults to ~/.agenter/auth-service",
            }),
        async (args) => {
          if (String(args._[0]) === "profile-service") {
            console.warn("[deprecated] use `agenter auth-service` instead of `agenter profile-service`.");
          }
          const handle = await startStandaloneAuthService({
            host: String(args.host),
            port: Number(args.port),
            dataDir: typeof args.dataDir === "string" ? args.dataDir : undefined,
          });
          console.log(`agenter auth-service listening on http://${handle.host}:${handle.port}`);
          await waitForSignal(async () => {
            await handle.stop();
          });
        },
      )
      .command(
        "daemon [action]",
        "manage daemon server",
        (builder) =>
          withAuthServiceBridgeOptions(builder).positional("action", {
            type: "string",
            choices: ["start", "stop", "restart"],
            default: "start",
          }),
        async (args) => {
          const daemonArgs = {
            host: String(args.host),
            port: Number(args.port),
            authServiceEndpoint: typeof args.authServiceEndpoint === "string" ? args.authServiceEndpoint : undefined,
            authServiceDataDir: typeof args.authServiceDataDir === "string" ? args.authServiceDataDir : undefined,
            authServiceHost: typeof args.authServiceHost === "string" ? args.authServiceHost : undefined,
            authServicePort: typeof args.authServicePort === "number" ? args.authServicePort : undefined,
          };
          if (isForegroundDaemonServeRequested()) {
            await runDaemonServeForeground(daemonArgs);
            return;
          }
          const action = resolveDaemonCommandAction(args.action);
          if (action === "stop") {
            await runDaemonStopCommand();
            return;
          }
          if (action === "restart") {
            const result = await stopManagedDaemonForHomeRoot();
            if (result.kind === "foreign" || result.kind === "timeout") {
              await runDaemonStopCommand();
              return;
            }
          }
          await runDaemonStartCommand(daemonArgs);
        },
      )
      .command(
        "doctor",
        "check daemon connectivity",
        (builder) => builder,
        async (args) => {
          const common: CommonArgs = {
            host: String(args.host),
            port: Number(args.port),
          };
          const alive = await isDaemonAlive(common);
          if (!alive) {
            console.log(`daemon is not reachable at ${resolveDaemonHealthLabel(common)}`);
            process.exitCode = 1;
            return;
          }
          console.log(`daemon is healthy at ${resolveDaemonHealthLabel(common)}`);
        },
      )
      .demandCommand(1)
      .strict()
      .help()
      .parseAsync();
  } catch (error) {
    if (error instanceof DaemonCompatibilityError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (!argv._.length) {
    process.exitCode = 1;
  }
};
