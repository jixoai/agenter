import yargs from "yargs";

import { CLI_SHELL_DEFAULT_AVATAR, CLI_SHELL_DEFAULT_SESSION } from "./product";

const metadataOnlyTokens = new Set(["--help", "-h", "help", "--version", "-v", "version"]);
const cleanupCommandTokens = new Set(["cleanup", "clean"]);
const roomCommandTokens = new Set(["room", "chat"]);
const topCommandTokens = new Set(["top", "notifications"]);
const helpPanelCommandTokens = new Set(["help-panel"]);
const shellCommandTokens = new Set(["shell", "terminal"]);
const tmuxActionCommandTokens = new Set(["tmux-action"]);
const heartbeatStatusCommandTokens = new Set(["heartbeat-status"]);

interface CliShellBaseArgs {
  avatarNickname: string;
  shellName: string;
  createAvatar: boolean;
  clearAvatar: boolean;
  host: string;
  port: number;
  authServiceEndpoint?: string;
}

export interface CliShellAttachArgs extends CliShellBaseArgs {
  command: "attach";
  tmux: string;
}

export interface CliShellRoomArgs extends CliShellBaseArgs {
  command: "room";
}

export interface CliShellTopArgs extends CliShellBaseArgs {
  command: "top";
}

export interface CliShellHelpPanelArgs extends CliShellBaseArgs {
  command: "help-panel";
}

export interface CliShellShellArgs extends CliShellBaseArgs {
  command: "shell";
}

export interface CliShellCleanupArgs {
  command: "cleanup";
  shellName?: string;
  confirm: boolean;
  tmux: string;
  host: string;
  port: number;
  authServiceEndpoint?: string;
}

export interface CliShellTmuxActionArgs {
  command: "tmux-action";
  action: string;
  avatarNickname: string;
  shellName: string;
  runtimeSessionId: string;
  workspacePath?: string;
  tmux: string;
  socket: string;
  targetPane: string;
  targetClient?: string;
  host: string;
  port: number;
  authServiceEndpoint?: string;
}

export interface CliShellHeartbeatStatusArgs {
  command: "heartbeat-status";
  avatarNickname: string;
  shellName: string;
  runtimeSessionId: string;
  tmux: string;
  host: string;
  port: number;
  authServiceEndpoint?: string;
}

export type CliShellParsedArgs =
  | CliShellAttachArgs
  | CliShellRoomArgs
  | CliShellTopArgs
  | CliShellHelpPanelArgs
  | CliShellShellArgs
  | CliShellCleanupArgs
  | CliShellTmuxActionArgs
  | CliShellHeartbeatStatusArgs;

interface CliShellArgvParseResult {
  host: string;
  port: number;
  authServiceEndpoint?: string;
  session: string;
  avatar?: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
  tmux?: string;
  _: Array<string | number>;
}

interface CliShellCleanupArgvParseResult {
  host: string;
  port: number;
  authServiceEndpoint?: string;
  session?: string;
  confirm?: boolean;
  tmux?: string;
  _: Array<string | number>;
}

interface CliShellTmuxActionArgvParseResult {
  action: string;
  host: string;
  port: number;
  authServiceEndpoint?: string;
  session: string;
  avatar?: string;
  runtimeSessionId?: string;
  workspacePath?: string;
  tmux?: string;
  socket?: string;
  targetPane?: string;
  targetClient?: string;
  _: Array<string | number>;
}

interface CliShellHeartbeatStatusArgvParseResult {
  host: string;
  port: number;
  authServiceEndpoint?: string;
  session: string;
  avatar?: string;
  runtimeSessionId: string;
  tmux?: string;
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

const normalizeAvatarNickname = (value: string | undefined, source: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${source} cannot be empty`);
  }
  if (trimmed.startsWith("@")) {
    throw new Error(`${source} must be an Avatar nickname without @`);
  }
  return trimmed;
};

const normalizeTmuxExecutable = (value: string | undefined): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "tmux";
};

const rejectUnsupportedLegacyFlags = (argv: readonly string[]): void => {
  const legacy = argv.find(
    (item) =>
      item === "--test-avatar" ||
      item.startsWith("--test-avatar=") ||
      item === "--backend" ||
      item.startsWith("--backend=") ||
      item === "--web" ||
      item.startsWith("--web=") ||
      item === "--experimental-dynamic-refresh" ||
      item.startsWith("--experimental-dynamic-refresh="),
  );
  if (legacy) {
    throw new Error(`unsupported cli-shell flag after tmux migration: ${legacy}`);
  }
};

export const normalizeShellName = (value: string | undefined): string => {
  const trimmed = value?.trim() || CLI_SHELL_DEFAULT_SESSION;
  return trimmed.startsWith("shell-") ? trimmed : `shell-${trimmed}`;
};

export const isCliShellMetadataOnlyArgv = (argv: readonly string[]): boolean => {
  const firstToken = argv[0];
  if (!firstToken) {
    return false;
  }
  if (metadataOnlyTokens.has(firstToken)) {
    return true;
  }
  const secondToken = argv[1];
  return firstToken.startsWith("@") && secondToken !== undefined && metadataOnlyTokens.has(secondToken);
};

export const isCliShellCleanupCommand = (argv: readonly string[]): boolean => cleanupCommandTokens.has(argv[0] ?? "");
export const isCliShellRoomCommand = (argv: readonly string[]): boolean => roomCommandTokens.has(argv[0] ?? "");
export const isCliShellTopCommand = (argv: readonly string[]): boolean => topCommandTokens.has(argv[0] ?? "");
export const isCliShellHelpPanelCommand = (argv: readonly string[]): boolean =>
  helpPanelCommandTokens.has(argv[0] ?? "");
export const isCliShellShellCommand = (argv: readonly string[]): boolean => shellCommandTokens.has(argv[0] ?? "");
export const isCliShellTmuxActionCommand = (argv: readonly string[]): boolean =>
  tmuxActionCommandTokens.has(argv[0] ?? "");
export const isCliShellHeartbeatStatusCommand = (argv: readonly string[]): boolean =>
  heartbeatStatusCommandTokens.has(argv[0] ?? "");

const parseAvatarSelection = (parsed: CliShellArgvParseResult): string => {
  const mentions = parsed._.map(String);
  if (mentions.length > 1) {
    throw new Error(`unexpected extra argv: ${mentions.slice(1).join(" ")}`);
  }
  const mentionAvatar = mentions.length === 1 ? normalizeAvatarMention(mentions[0]) : undefined;
  const flagAvatar = normalizeAvatarNickname(typeof parsed.avatar === "string" ? parsed.avatar : undefined, "--avatar");
  if (mentionAvatar && flagAvatar && mentionAvatar !== flagAvatar) {
    throw new Error(`conflicting avatar selectors: @${mentionAvatar} and --avatar=${flagAvatar}`);
  }
  return flagAvatar ?? mentionAvatar ?? CLI_SHELL_DEFAULT_AVATAR;
};

const baseParser = (argv: readonly string[], env: NodeJS.ProcessEnv, scriptName: string) =>
  yargs([...argv])
    .scriptName(scriptName)
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
    .option("avatar", {
      type: "string",
    })
    .option("create-avatar", {
      type: "boolean",
      default: false,
    })
    .option("clear-avatar", {
      type: "boolean",
      default: false,
    })
    .strictOptions()
    .exitProcess(false)
    .help();

export const parseCliShellArgs = (
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): CliShellParsedArgs => {
  rejectUnsupportedLegacyFlags(argv);
  if (isCliShellRoomCommand(argv)) {
    const parsed = baseParser(argv.slice(1), env, "agenter-cli-shell room").parseSync() as CliShellArgvParseResult;
    return {
      command: "room",
      avatarNickname: parseAvatarSelection(parsed),
      shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
      createAvatar: parsed.createAvatar === true,
      clearAvatar: parsed.clearAvatar === true,
      host: String(parsed.host),
      port: Number(parsed.port),
      authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
    };
  }
  if (isCliShellTopCommand(argv)) {
    const parsed = baseParser(argv.slice(1), env, "agenter-cli-shell top").parseSync() as CliShellArgvParseResult;
    return {
      command: "top",
      avatarNickname: parseAvatarSelection(parsed),
      shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
      createAvatar: parsed.createAvatar === true,
      clearAvatar: parsed.clearAvatar === true,
      host: String(parsed.host),
      port: Number(parsed.port),
      authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
    };
  }
  if (isCliShellHelpPanelCommand(argv)) {
    const parsed = baseParser(argv.slice(1), env, "agenter-cli-shell help-panel").parseSync() as CliShellArgvParseResult;
    return {
      command: "help-panel",
      avatarNickname: parseAvatarSelection(parsed),
      shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
      createAvatar: parsed.createAvatar === true,
      clearAvatar: parsed.clearAvatar === true,
      host: String(parsed.host),
      port: Number(parsed.port),
      authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
    };
  }
  if (isCliShellShellCommand(argv)) {
    const parsed = baseParser(argv.slice(1), env, "agenter-cli-shell shell").parseSync() as CliShellArgvParseResult;
    return {
      command: "shell",
      avatarNickname: parseAvatarSelection(parsed),
      shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
      createAvatar: parsed.createAvatar === true,
      clearAvatar: parsed.clearAvatar === true,
      host: String(parsed.host),
      port: Number(parsed.port),
      authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
    };
  }
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
      .option("tmux", {
        type: "string",
        default: "tmux",
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
      tmux: normalizeTmuxExecutable(parsed.tmux),
      host: String(parsed.host),
      port: Number(parsed.port),
      authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
    };
  }
  if (isCliShellTmuxActionCommand(argv)) {
    const parsed = baseParser(argv.slice(1), env, "agenter-cli-shell tmux-action")
      .option("action", {
        type: "string",
        demandOption: true,
      })
      .option("runtime-session-id", {
        type: "string",
        demandOption: true,
      })
      .option("workspace-path", {
        type: "string",
      })
      .option("tmux", {
        type: "string",
        default: "tmux",
      })
      .option("socket", {
        type: "string",
        default: "agenter-cli-shell",
      })
      .option("target-pane", {
        type: "string",
        demandOption: true,
      })
      .option("target-client", {
        type: "string",
      })
      .parseSync() as CliShellTmuxActionArgvParseResult;
    if (parsed._.length > 0) {
      throw new Error(`unexpected tmux-action argv: ${parsed._.map(String).join(" ")}`);
    }
    const action = parsed.action.trim();
    if (action.length === 0) {
      throw new Error("tmux-action --action cannot be empty");
    }
    const runtimeSessionId = parsed.runtimeSessionId?.trim();
    if (!runtimeSessionId) {
      throw new Error("tmux-action --runtime-session-id cannot be empty");
    }
    const workspacePath = parsed.workspacePath?.trim();
    if (workspacePath !== undefined && workspacePath.length === 0) {
      throw new Error("tmux-action --workspace-path cannot be empty");
    }
    const socket = parsed.socket?.trim() || "agenter-cli-shell";
    const targetPane = parsed.targetPane?.trim();
    if (!targetPane) {
      throw new Error("tmux-action --target-pane cannot be empty");
    }
    const targetClient = parsed.targetClient?.trim();
    return {
      command: "tmux-action",
      action,
      avatarNickname: parseAvatarSelection(parsed),
      shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
      runtimeSessionId,
      workspacePath,
      tmux: normalizeTmuxExecutable(parsed.tmux),
      socket,
      targetPane,
      targetClient: targetClient && targetClient.length > 0 ? targetClient : undefined,
      host: String(parsed.host),
      port: Number(parsed.port),
      authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
    };
  }
  if (isCliShellHeartbeatStatusCommand(argv)) {
    const parsed = baseParser(argv.slice(1), env, "agenter-cli-shell heartbeat-status")
      .option("runtime-session-id", {
        type: "string",
        demandOption: true,
      })
      .option("tmux", {
        type: "string",
        default: "tmux",
      })
      .parseSync() as CliShellHeartbeatStatusArgvParseResult;
    if (parsed._.length > 0) {
      throw new Error(`unexpected heartbeat-status argv: ${parsed._.map(String).join(" ")}`);
    }
    const runtimeSessionId = parsed.runtimeSessionId?.trim();
    if (!runtimeSessionId) {
      throw new Error("heartbeat-status --runtime-session-id cannot be empty");
    }
    return {
      command: "heartbeat-status",
      avatarNickname: parseAvatarSelection(parsed),
      shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
      runtimeSessionId,
      tmux: normalizeTmuxExecutable(parsed.tmux),
      host: String(parsed.host),
      port: Number(parsed.port),
      authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
    };
  }

  const parsed = baseParser(argv, env, "agenter-cli-shell")
    .option("tmux", {
      type: "string",
      default: "tmux",
    })
    .parseSync() as CliShellArgvParseResult;

  return {
    command: "attach",
    avatarNickname: parseAvatarSelection(parsed),
    shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
    createAvatar: parsed.createAvatar === true,
    clearAvatar: parsed.clearAvatar === true,
    tmux: normalizeTmuxExecutable(parsed.tmux),
    host: String(parsed.host),
    port: Number(parsed.port),
    authServiceEndpoint: typeof parsed.authServiceEndpoint === "string" ? parsed.authServiceEndpoint : undefined,
  };
};
