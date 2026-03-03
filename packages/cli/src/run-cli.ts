import { runTuiClient } from "@agenter/tui";
import { join } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { assertStaticDir, startTrpcServer, type TrpcServerHandle } from "./trpc-server";

interface CommonArgs {
  host: string;
  port: number;
}

const waitForever = async (): Promise<void> => {
  await new Promise<void>(() => {
    // keep process alive until SIGINT/SIGTERM
  });
};

const healthUrl = (args: CommonArgs): string => `http://${args.host}:${args.port}/health`;

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
    staticDir,
  });
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
        await waitForever();
      },
    )
    .command(
      "web",
      "start daemon with webui entry",
      (builder) => builder,
      async (args) => {
        const daemon = await startDaemon({
          host: String(args.host),
          port: Number(args.port),
          web: true,
        });
        console.log(`agenter web listening on http://${daemon.host}:${daemon.port}`);
        await waitForever();
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
