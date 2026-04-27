#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 4291;
const DEFAULT_HOSTNAME = "127.0.0.1";
const DEFAULT_DEVICE = "chrome";

type CliConfig = {
  readonly device: string;
  readonly extraFlutterArgs: readonly string[];
  readonly help: boolean;
  readonly hostname: string;
  readonly port: number;
  readonly wasm: boolean;
};

class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const exampleDir = resolve(scriptDir, "..");
const pubspecPath = resolve(exampleDir, "pubspec.yaml");

function readBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new CliError(`Invalid port "${value}". Expected an integer from 1 to 65535.`);
  }
  return port;
}

function readRequiredValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("-")) {
    throw new CliError(`Missing value for ${flag}.`);
  }
  return value;
}

function parseCliArgs(args: readonly string[]): CliConfig {
  let port = parsePort(process.env.PORT ?? String(DEFAULT_PORT));
  let hostname = process.env.FLUTTER_WEB_HOSTNAME ?? DEFAULT_HOSTNAME;
  let device = process.env.FLUTTER_DEVICE ?? DEFAULT_DEVICE;
  let wasm = readBooleanEnv(process.env.FLUTTER_WEB_WASM, true);
  const extraFlutterArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      extraFlutterArgs.push(...args.slice(index + 1));
      break;
    }

    if (arg === "--help" || arg === "-h") {
      return { device, extraFlutterArgs, help: true, hostname, port, wasm };
    }

    if (arg === "--no-wasm") {
      wasm = false;
      continue;
    }

    if (arg === "--wasm") {
      wasm = true;
      continue;
    }

    if (arg === "--port" || arg === "-p") {
      port = parsePort(readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }

    if (arg === "--hostname" || arg === "--host") {
      hostname = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--hostname=")) {
      hostname = arg.slice("--hostname=".length);
      continue;
    }

    if (arg.startsWith("--host=")) {
      hostname = arg.slice("--host=".length);
      continue;
    }

    if (arg === "--device" || arg === "-d") {
      device = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--device=")) {
      device = arg.slice("--device=".length);
      continue;
    }

    if (/^\d+$/.test(arg)) {
      port = parsePort(arg);
      continue;
    }

    throw new CliError(`Unknown option "${arg}". Use --help for usage.`);
  }

  return { device, extraFlutterArgs, help: false, hostname, port, wasm };
}

function printHelp(): void {
  console.log(`Run the flutter_chat_view example as Flutter Web.

Usage:
  bun run flutter-chat-view:web
  bun run flutter-chat-view:web -- --port 4300
  PORT=4300 bun run flutter-chat-view:web

Options:
  -p, --port <port>       Web server port. Defaults to ${DEFAULT_PORT}.
      --host <hostname>   Web hostname. Defaults to ${DEFAULT_HOSTNAME}.
  -d, --device <device>   Flutter device id. Defaults to ${DEFAULT_DEVICE}.
      --wasm              Enable Flutter Web Wasm mode. Enabled by default.
      --no-wasm           Run without Wasm.
  -h, --help              Show this help.
  -- <args>               Pass remaining args directly to flutter run.

Environment:
  PORT                    Overrides the default port.
  FLUTTER_WEB_HOSTNAME    Overrides the default hostname.
  FLUTTER_DEVICE          Overrides the default Flutter device.
  FLUTTER_WEB_WASM=false  Disables Wasm mode by default.
`);
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function main(): void {
  const config = parseCliArgs(process.argv.slice(2));

  if (config.help) {
    printHelp();
    return;
  }

  if (!existsSync(pubspecPath)) {
    throw new CliError(`Expected Flutter example pubspec at ${pubspecPath}.`);
  }

  const flutterArgs = [
    "run",
    "-d",
    config.device,
    "--web-hostname",
    config.hostname,
    "--web-port",
    String(config.port),
    ...(config.wasm ? ["--wasm"] : []),
    ...config.extraFlutterArgs,
  ];

  console.log(
    `Starting flutter_chat_view example at http://${config.hostname}:${config.port}/ (${config.wasm ? "wasm" : "js"})`,
  );
  console.log(`$ flutter ${flutterArgs.map(shellQuote).join(" ")}`);

  const child = spawn("flutter", flutterArgs, {
    cwd: exampleDir,
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  child.on("exit", (code, signal) => {
    if (signal !== null) {
      process.exit(128);
    }
    process.exit(code ?? 1);
  });
}

try {
  main();
} catch (error) {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
