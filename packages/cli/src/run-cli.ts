import { type AuthServiceBridgeOptions } from "@agenter/app-server";
import { join } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  buildProductLaunchEnv,
  buildProductProcessCommand,
  isBuiltInCommand,
  isProductMetadataOnlyArgv,
  readCommandToken,
  resolveProductCommandInvocation,
  resolveProductLaunchTarget,
} from "./product-command-launcher";
import type { AuthServiceHandle } from "@agenter/auth-service";
import type { TrpcServerHandle } from "./trpc-server";
import { resolveCanonicalWebUiAssetRoot } from "./webui-static-root";

interface CommonArgs {
  host: string;
  port: number;
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

const BUN_BIN = Bun.which("bun") ?? process.execPath;

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
const webUrl = (args: { host: string; port: number }): string => `http://${args.host}:${args.port}`;

const isDaemonAlive = async (args: CommonArgs): Promise<boolean> => {
  try {
    const response = await fetch(healthUrl(args));
    return response.ok;
  } catch {
    return false;
  }
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
    authService: resolveAuthServiceBridgeOptions(args),
  });
};

const startStandaloneAuthService = async (
  args: StandaloneAuthServiceCliArgs,
): Promise<AuthServiceHandle> => {
  const { startAuthServiceServer } = await import("@agenter/auth-service");
  return await startAuthServiceServer({
    host: args.host,
    port: args.port,
    dataDir: args.dataDir,
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

const waitForHttpServer = async (url: string, timeoutMs = 30_000): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      // ignore until timeout
    }
    await Bun.sleep(200);
  }
  throw new Error(`web dev server did not become ready: ${url}`);
};

const startWebDevServer = async (input: {
  host: string;
  webPort: number;
  trpcHost: string;
  trpcPort: number;
}): Promise<Bun.Subprocess<"ignore", "inherit", "inherit">> => {
  const webuiDir = join(import.meta.dir, "../../webui");
  const proc = Bun.spawn({
    cmd: [BUN_BIN, "run", "dev", "--host", input.host, "--port", String(input.webPort)],
    cwd: webuiDir,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      PUBLIC_AGENTER_WS_URL: `ws://${input.trpcHost}:${input.trpcPort}/trpc`,
    },
  });
  await waitForHttpServer(webUrl({ host: input.host, port: input.webPort }));
  return proc;
};

const launchProductCommand = async (argvInput: readonly string[]): Promise<boolean> => {
  const routed = resolveProductCommandInvocation(argvInput);
  if (!routed) {
    const commandToken = readCommandToken(argvInput);
    if (commandToken && !isBuiltInCommand(commandToken)) {
      console.error(`unsupported product command: ${commandToken}`);
      process.exitCode = 1;
      return true;
    }
    return false;
  }

  const target = resolveProductLaunchTarget(routed.descriptor, {
    cliSourceDir: import.meta.dir,
  });
  const common: CommonArgs = {
    host: routed.launcherOptions.host,
    port: routed.launcherOptions.port,
  };
  const needsRuntimeBootstrap =
    routed.descriptor.capabilityHints.requiresDaemon && !isProductMetadataOnlyArgv(routed.productArgv);

  let localDaemon: TrpcServerHandle | null = null;
  if (needsRuntimeBootstrap && !(await isDaemonAlive(common))) {
    localDaemon = await startDaemon({
      ...common,
      authServiceEndpoint: routed.launcherOptions.authServiceEndpoint,
      authServiceDataDir: routed.launcherOptions.authServiceDataDir,
      authServiceHost: routed.launcherOptions.authServiceHost,
      authServicePort: routed.launcherOptions.authServicePort,
    });
  }

  const env = buildProductLaunchEnv({
    descriptor: routed.descriptor,
    source: target.source,
    launcherOptions: routed.launcherOptions,
  });
  const child = Bun.spawn({
    cmd: buildProductProcessCommand(target, routed.descriptor, routed.productArgv, env),
    cwd: process.cwd(),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env,
  });

  try {
    const exitCode = await child.exited;
    process.exitCode = exitCode;
  } finally {
    if (localDaemon) {
      await localDaemon.stop();
    }
  }

  return true;
};

export const runCli = async (argvInput = process.argv): Promise<void> => {
  const rawArgs = hideBin(argvInput);
  if (await launchProductCommand(rawArgs)) {
    return;
  }

  const argv = await yargs(rawArgs)
    .scriptName("agenter")
    .option("host", {
      type: "string",
      default: "127.0.0.1",
      describe: "daemon host",
    })
    .option("port", {
      type: "number",
      default: 4580,
      describe: "daemon port",
    })
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
      "daemon",
      "start daemon server",
      (builder) => withAuthServiceBridgeOptions(builder),
      async (args) => {
        const daemon = await startDaemon({
          host: String(args.host),
          port: Number(args.port),
          authServiceEndpoint: typeof args.authServiceEndpoint === "string" ? args.authServiceEndpoint : undefined,
          authServiceDataDir: typeof args.authServiceDataDir === "string" ? args.authServiceDataDir : undefined,
          authServiceHost: typeof args.authServiceHost === "string" ? args.authServiceHost : undefined,
          authServicePort: typeof args.authServicePort === "number" ? args.authServicePort : undefined,
        });
        console.log(`agenter daemon listening on ${daemon.host}:${daemon.port}`);
        await waitForSignal(async () => {
          await daemon.stop();
        });
      },
    )
    .command(
      "web",
      "start daemon with webui entry",
      (builder) =>
        withAuthServiceBridgeOptions(builder)
          .option("dev", {
            type: "boolean",
            default: false,
            describe: "run webui in vite dev mode (no build needed)",
          })
          .option("web-port", {
            type: "number",
            default: 4173,
            describe: "webui port in --dev mode",
          }),
      async (args) => {
        const host = String(args.host);
        const port = Number(args.port);
        const dev = Boolean(args.dev);
        const webPort = Number(args.webPort);

        const daemon = await startDaemon({
          host,
          port,
          staticDir: dev ? undefined : resolveCanonicalWebUiAssetRoot(import.meta.dir).staticDir,
          publicEnv: dev ? undefined : {},
          authServiceEndpoint: typeof args.authServiceEndpoint === "string" ? args.authServiceEndpoint : undefined,
          authServiceDataDir: typeof args.authServiceDataDir === "string" ? args.authServiceDataDir : undefined,
          authServiceHost: typeof args.authServiceHost === "string" ? args.authServiceHost : undefined,
          authServicePort: typeof args.authServicePort === "number" ? args.authServicePort : undefined,
        });

        if (!dev) {
          console.log(`agenter web listening on http://${daemon.host}:${daemon.port}`);
          await waitForSignal(async () => {
            await daemon.stop();
          });
          return;
        }

        const webDev = await startWebDevServer({
          host: String(args.host),
          webPort,
          trpcHost: daemon.host,
          trpcPort: daemon.port,
        });
        console.log(`agenter web (dev) api: http://${daemon.host}:${daemon.port}`);
        console.log(`agenter web (dev) ui:  http://${host}:${webPort}`);

        await waitForSignal(async () => {
          webDev.kill();
          await daemon.stop();
        });
      },
    )
    .command(
      "tui",
      "run tui client (auto-start daemon when absent)",
      (builder) => withAuthServiceBridgeOptions(builder),
      async (args) => {
        const common: CommonArgs = {
          host: String(args.host),
          port: Number(args.port),
        };

        let localDaemon: TrpcServerHandle | null = null;
        if (!(await isDaemonAlive(common))) {
          localDaemon = await startDaemon({
            ...common,
            authServiceEndpoint: typeof args.authServiceEndpoint === "string" ? args.authServiceEndpoint : undefined,
            authServiceDataDir: typeof args.authServiceDataDir === "string" ? args.authServiceDataDir : undefined,
            authServiceHost: typeof args.authServiceHost === "string" ? args.authServiceHost : undefined,
            authServicePort: typeof args.authServicePort === "number" ? args.authServicePort : undefined,
          });
        }

        const { runTuiClient } = await import("@agenter/tui");
        await runTuiClient(common);
        if (localDaemon) {
          await localDaemon.stop();
        }
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
          console.log(`daemon is not reachable at ${healthUrl(common)}`);
          process.exitCode = 1;
          return;
        }
        console.log(`daemon is healthy at ${healthUrl(common)}`);
      },
    )
    .demandCommand(1)
    .strict()
    .help()
    .parseAsync();

  if (!argv._.length) {
    process.exitCode = 1;
  }
};
