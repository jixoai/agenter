import yargs from "yargs";

import { assertTerminalBackendKind, type TerminalBackendKind } from "@agenter/termless-core";

import { CLI_SHELL_DEFAULT_AVATAR, CLI_SHELL_DEFAULT_SESSION } from "./product";

const metadataOnlyTokens = new Set(["--help", "-h", "help", "--version", "-v", "version"]);

export interface CliShellParsedArgs {
  avatarNickname: string;
  shellName: string;
  backend?: TerminalBackendKind;
  host: string;
  port: number;
  authServiceEndpoint?: string;
}

interface CliShellArgvParseResult {
  backend?: string;
  host: string;
  port: number;
  authServiceEndpoint?: string;
  session: string;
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

export const parseCliShellArgs = (argv: readonly string[], env: NodeJS.ProcessEnv = process.env): CliShellParsedArgs => {
  const parsed = yargs([...argv])
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
    .strictOptions()
    .exitProcess(false)
    .help()
    .parseSync() as CliShellArgvParseResult;

  const mentions = parsed._.map(String);
  if (mentions.length > 1) {
    throw new Error(`unexpected extra argv: ${mentions.slice(1).join(" ")}`);
  }

  return {
    avatarNickname: normalizeAvatarMention(mentions[0]),
    shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
    backend: typeof parsed.backend === "string" ? assertTerminalBackendKind(parsed.backend) : undefined,
    host: String(parsed.host),
    port: Number(parsed.port),
    authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
  };
};
