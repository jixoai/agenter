import { runTuiClient } from "@agenter/tui";
import { join } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { assertStaticDir, startTrpcServer, type TrpcServerHandle } from "./trpc-server";

interface CommonArgs {
  host: string;
  port: number;
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

const startDaemon = async (args: CommonArgs & { web: boolean }): Promise<TrpcServerHandle> => {
  const staticDir = args.web ? join(import.meta.dir, "../assets/webui") : undefined;
  if (staticDir) {
    assertStaticDir(staticDir);
  }
  return await startTrpcServer({
    host: args.host,
    port: args.port,
    workspaceCwd: process.cwd(),
    staticDir,
  });
};

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
}): Promise<Subprocess> => {
  const webuiDir = join(import.meta.dir, "../../webui");
  const proc = Bun.spawn({
    cmd: [BUN_BIN, "run", "dev", "--host", input.host, "--port", String(input.webPort)],
    cwd: webuiDir,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      VITE_AGENTER_WS_URL: `ws://${input.trpcHost}:${input.trpcPort}/trpc`,
    },
  });
  await waitForHttpServer(webUrl({ host: input.host, port: input.webPort }));
  return proc;
};

export const runCli = async (argvInput = process.argv): Promise<void> => {
  const argv = await yargs(hideBin(argvInput))
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
      "daemon",
      "start daemon server",
      (builder) => builder,
      async (args) => {
        const daemon = await startDaemon({
          host: String(args.host),
          port: Number(args.port),
          web: false,
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
        builder
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
          web: !dev,
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
      (builder) => builder,
      async (args) => {
        const common: CommonArgs = {
          host: String(args.host),
          port: Number(args.port),
        };

        let localDaemon: TrpcServerHandle | null = null;
        if (!(await isDaemonAlive(common))) {
          localDaemon = await startDaemon({ ...common, web: false });
        }

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
