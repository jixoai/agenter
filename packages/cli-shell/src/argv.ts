import yargs from "yargs";

import { assertTerminalBackendKind, type TerminalBackendKind } from "@agenter/termless-core";

import { CLI_SHELL_DEFAULT_AVATAR, CLI_SHELL_DEFAULT_SESSION } from "./product";

const metadataOnlyTokens = new Set(["--help", "-h", "help", "--version", "-v", "version"]);
const cleanupCommandTokens = new Set(["cleanup", "clean"]);

export interface CliShellAttachArgs {
  command: "attach";
  avatarNickname: string;
  shellName: string;
  backend?: TerminalBackendKind;
  webPort?: number;
  debug: boolean;
  debugFilters: string[];
  experimentalDynamicRefresh: boolean;
  host: string;
  port: number;
  authServiceEndpoint?: string;
}

export interface CliShellCleanupArgs {
  command: "cleanup";
  shellName?: string;
  confirm: boolean;
  host: string;
  port: number;
  authServiceEndpoint?: string;
}

export type CliShellParsedArgs = CliShellAttachArgs | CliShellCleanupArgs;

interface CliShellArgvParseResult {
  backend?: string;
  host: string;
  port: number;
  authServiceEndpoint?: string;
  session: string;
  debug?: boolean | string;
  experimentalDynamicRefresh?: boolean;
  _: Array<string | number>;
}

interface CliShellCleanupArgvParseResult {
  host: string;
  port: number;
  authServiceEndpoint?: string;
  session?: string;
  confirm?: boolean;
  _: Array<string | number>;
}

const normalizeAvatarMention = (value: string | undefined): string => {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return CLI_SHELL_DEFAULT_AVATAR;
  }
  if (!trimmed.startsWith("@")) {
    throw new Error(`invalid avatar mention: ${trimmed}`);
  }
  const nickname = trimmed.slice(1).trim();
  if (nickname.length === 0) {
    throw new Error("avatar mention cannot be empty");
  }
  return nickname;
};

export const normalizeShellName = (value: string | undefined): string => {
  const trimmed = value?.trim() || CLI_SHELL_DEFAULT_SESSION;
  return trimmed.startsWith("shell-") ? trimmed : `shell-${trimmed}`;
};

export const isCliShellMetadataOnlyArgv = (argv: readonly string[]): boolean =>
  argv.some((token) => metadataOnlyTokens.has(token));

export const isCliShellCleanupCommand = (argv: readonly string[]): boolean => cleanupCommandTokens.has(argv[0] ?? "");

const parseOptionalWebPortToken = (value: string): number => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`invalid --web port: ${value}`);
  }
  return parsed;
};

const extractWebHostMode = (argv: readonly string[]): { argv: string[]; webPort?: number } => {
  const nextArgv: string[] = [];
  let webPort: number | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--web") {
      const nextToken = argv[index + 1];
      if (typeof nextToken === "string" && /^\d+$/.test(nextToken.trim())) {
        webPort = parseOptionalWebPortToken(nextToken);
        index += 1;
      } else {
        webPort = 0;
      }
      continue;
    }
    if (token.startsWith("--web=")) {
      webPort = parseOptionalWebPortToken(token.slice("--web=".length));
      continue;
    }
    nextArgv.push(token);
  }
  return {
    argv: nextArgv,
    webPort,
  };
};

const normalizeDebugArgv = (argv: readonly string[]): string[] =>
  argv.map((token) => (token === "--debug" ? "--debug=true" : token));

const normalizeDebugArg = (value: boolean | string | undefined): { debug: boolean; debugFilters: string[] } => {
  if (value === true) {
    return { debug: true, debugFilters: [] };
  }
  if (value === false || value === undefined) {
    return { debug: false, debugFilters: [] };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "true" || trimmed === "1") {
    return { debug: true, debugFilters: [] };
  }
  if (trimmed === "false" || trimmed === "0") {
    return { debug: false, debugFilters: [] };
  }
  return {
    debug: true,
    debugFilters: trimmed
      .split(",")
      .map((part) => part.trim().toLowerCase().replace(/^\*+|\*+$/g, ""))
      .filter((part) => part.length > 0),
  };
};

export const parseCliShellArgs = (argv: readonly string[], env: NodeJS.ProcessEnv = process.env): CliShellParsedArgs => {
  if (isCliShellCleanupCommand(argv)) {
    const parsed = yargs(argv.slice(1))
      .scriptName("agenter-cli-shell cleanup")
      .option("host", {
        type: "string",
        default: env.AGENTER_DAEMON_HOST?.trim() || "127.0.0.1",
      })
      .option("port", {
        type: "number",
        default: Number(env.AGENTER_DAEMON_PORT ?? "4580"),
      })
      .option("auth-service-endpoint", {
        type: "string",
        default: env.AGENTER_AUTH_SERVICE_ENDPOINT?.trim() || undefined,
      })
      .option("session", {
        type: "string",
      })
      .option("confirm", {
        type: "boolean",
        default: false,
      })
      .strictOptions()
      .exitProcess(false)
      .help()
      .parseSync() as CliShellCleanupArgvParseResult;
    if (parsed._.length > 0) {
      throw new Error(`unexpected cleanup argv: ${parsed._.map(String).join(" ")}`);
    }
    return {
      command: "cleanup",
      shellName: typeof parsed.session === "string" ? normalizeShellName(parsed.session) : undefined,
      confirm: parsed.confirm === true,
      host: String(parsed.host),
      port: Number(parsed.port),
      authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
    };
  }
  const extracted = extractWebHostMode(argv);
  const parsed = yargs(normalizeDebugArgv(extracted.argv))
    .scriptName("agenter-cli-shell")
    .option("host", {
      type: "string",
      default: env.AGENTER_DAEMON_HOST?.trim() || "127.0.0.1",
    })
    .option("port", {
      type: "number",
      default: Number(env.AGENTER_DAEMON_PORT ?? "4580"),
    })
    .option("auth-service-endpoint", {
      type: "string",
      default: env.AGENTER_AUTH_SERVICE_ENDPOINT?.trim() || undefined,
    })
    .option("session", {
      type: "string",
      default: CLI_SHELL_DEFAULT_SESSION,
    })
    .option("backend", {
      type: "string",
    })
    .option("debug", {
      type: "string",
      default: "false",
    })
    .option("experimental-dynamic-refresh", {
      type: "boolean",
      default: false,
    })
    .strictOptions()
    .exitProcess(false)
    .help()
    .parseSync() as CliShellArgvParseResult;

  const mentions = parsed._.map(String);
  if (mentions.length > 1) {
    throw new Error(`unexpected extra argv: ${mentions.slice(1).join(" ")}`);
  }
  const debug = normalizeDebugArg(parsed.debug);

  return {
    command: "attach",
    avatarNickname: normalizeAvatarMention(mentions[0]),
    shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
    backend: typeof parsed.backend === "string" ? assertTerminalBackendKind(parsed.backend) : undefined,
    webPort: extracted.webPort,
    debug: debug.debug,
    debugFilters: debug.debugFilters,
    experimentalDynamicRefresh: parsed.experimentalDynamicRefresh === true,
    host: String(parsed.host),
    port: Number(parsed.port),
    authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
  };
};
