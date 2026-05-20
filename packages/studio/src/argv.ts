import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export interface StudioArgs {
  webHost: string;
  daemonHost: string;
  daemonPort: number;
  dev: boolean;
  webPort: number;
}

export const parseStudioArgs = (argvInput = process.argv): StudioArgs => {
  const parsed = yargs(hideBin(argvInput))
    .scriptName("agenter studio")
    .option("web-host", {
      type: "string",
      default: "127.0.0.1",
      describe: "studio web host",
    })
    .option("web-port", {
      type: "number",
      default: 4173,
      describe: "studio web port",
    })
    .option("dev", {
      type: "boolean",
      default: false,
      describe: "run Studio in Vite dev mode",
    })
    .option("daemon-host", {
      type: "string",
      default: process.env.AGENTER_DAEMON_HOST ?? "127.0.0.1",
      describe: "agenter daemon host; normally provided by the product launcher",
    })
    .option("daemon-port", {
      type: "number",
      default: Number(process.env.AGENTER_DAEMON_PORT ?? 4580),
      describe: "agenter daemon port; normally provided by the product launcher",
    })
    .strict()
    .help()
    .version(false)
    .parseSync();

  return {
    webHost: String(parsed.webHost),
    daemonHost: String(parsed.daemonHost),
    daemonPort: Number(parsed.daemonPort),
    dev: Boolean(parsed.dev),
    webPort: Number(parsed.webPort),
  };
};
