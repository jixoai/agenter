import yargs from "yargs";

const metadataFlagTokens = new Set(["--help", "-h", "--version", "-v"]);
const metadataCommandTokens = new Set(["help", "version"]);
const localCommandTokens = new Set(["renderer-grid-demo"]);
const cleanupCommandTokens = new Set(["cleanup", "clean"]);
const tmuxActionCommandTokens = new Set(["tmux-action"]);
const legacyViewCommandTokens = new Map<string, ShellNextView>([
  ["room", "room"],
  ["chat", "room"],
  ["help-panel", "help"],
  ["top", "status"],
  ["notifications", "status"],
  ["shell", "shell"],
  ["terminal", "shell"],
  ["heartbeat-status", "status"],
]);

export const SHELL_NEXT_DEFAULT_AVATAR = "shell-assistant";
export const SHELL_NEXT_DEFAULT_SESSION = "1";
export type ShellNextView = "none" | "room" | "help" | "status" | "shell";
const shellNextViewChoices = ["none", "room", "help", "status", "shell"] as const satisfies readonly ShellNextView[];

interface ShellNextBaseArgvParseResult {
  host: string;
  port: number;
  authServiceEndpoint?: string;
  session?: string;
  avatar?: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
  view?: string;
  command?: string[];
  cwd?: string;
  selectionText?: string;
  confirm?: boolean;
  _: Array<string | number>;
}

interface ShellNextTmuxActionArgvParseResult extends ShellNextBaseArgvParseResult {
  action?: string;
}

export interface ShellNextBaseProductArgs {
  readonly host: string;
  readonly port: number;
  readonly authServiceEndpoint?: string;
  readonly shellName: string;
  readonly avatarNickname: string;
  readonly createAvatar: boolean;
  readonly clearAvatar: boolean;
}

export interface ShellNextAttachArgs extends ShellNextBaseProductArgs {
  readonly command: "attach";
  readonly view: ShellNextView;
  readonly sessionExplicit: boolean;
  readonly avatarExplicit: boolean;
}

export interface ShellNextCleanupArgs {
  readonly command: "cleanup";
  readonly host: string;
  readonly port: number;
  readonly authServiceEndpoint?: string;
  readonly shellName?: string;
  readonly confirm: boolean;
}

export interface ShellNextLocalArgs {
  readonly command: "local";
  readonly cwd: string;
  readonly shellCommand?: readonly string[];
}

export interface ShellNextRendererGridDemoArgs {
  readonly command: "renderer-grid-demo";
  readonly selectionText: string;
}

export interface ShellNextUnsupportedTmuxActionArgs {
  readonly command: "unsupported-tmux-action";
  readonly action: string;
}

export type ShellNextParsedArgs =
  | ShellNextAttachArgs
  | ShellNextCleanupArgs
  | ShellNextLocalArgs
  | ShellNextRendererGridDemoArgs
  | ShellNextUnsupportedTmuxActionArgs;

export const normalizeShellNextShellName = (value: string | undefined): string => {
  const trimmed = value?.trim() || SHELL_NEXT_DEFAULT_SESSION;
  return trimmed.startsWith("shell-") ? trimmed : `shell-${trimmed}`;
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

const normalizeAvatarMention = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
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

const parseAvatarSelection = (parsed: ShellNextBaseArgvParseResult): {
  avatarNickname: string;
  avatarExplicit: boolean;
} => {
  const mentions = parsed._.map(String).filter((item) => item.startsWith("@"));
  if (mentions.length > 1) {
    throw new Error(`unexpected extra avatar argv: ${mentions.slice(1).join(" ")}`);
  }
  const mentionAvatar = normalizeAvatarMention(mentions[0]);
  const flagAvatar = normalizeAvatarNickname(typeof parsed.avatar === "string" ? parsed.avatar : undefined, "--avatar");
  if (mentionAvatar && flagAvatar && mentionAvatar !== flagAvatar) {
    throw new Error(`conflicting avatar selectors: @${mentionAvatar} and --avatar=${flagAvatar}`);
  }
  return {
    avatarNickname: flagAvatar ?? mentionAvatar ?? SHELL_NEXT_DEFAULT_AVATAR,
    avatarExplicit: flagAvatar !== undefined || mentionAvatar !== undefined,
  };
};

const baseParser = (argv: readonly string[], env: NodeJS.ProcessEnv, scriptName = "agenter-shell-next") =>
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
    .option("cwd", {
      type: "string",
      default: process.cwd(),
    })
    .option("view", {
      type: "string",
      choices: [...shellNextViewChoices],
      default: "none",
    })
    .option("command", {
      type: "array",
      string: true,
    })
    .option("selection-text", {
      type: "string",
      default: "Drag across this selectable text to verify host selection inside pane.",
    })
    .option("confirm", {
      type: "boolean",
      default: false,
    })
    .help()
    .version(false)
    .exitProcess(false);

const toBaseProductArgs = (parsed: ShellNextBaseArgvParseResult): ShellNextBaseProductArgs & {
  sessionExplicit: boolean;
  avatarExplicit: boolean;
} => {
  const avatar = parseAvatarSelection(parsed);
  return {
    host: parsed.host,
    port: parsed.port,
    authServiceEndpoint: parsed.authServiceEndpoint,
    shellName: normalizeShellNextShellName(typeof parsed.session === "string" ? parsed.session : undefined),
    avatarNickname: avatar.avatarNickname,
    createAvatar: parsed.createAvatar === true,
    clearAvatar: parsed.clearAvatar === true,
    sessionExplicit: typeof parsed.session === "string" && parsed.session.trim().length > 0,
    avatarExplicit: avatar.avatarExplicit,
  };
};

const parseViewSelection = (parsed: ShellNextBaseArgvParseResult): ShellNextView =>
  shellNextViewChoices.includes(parsed.view as ShellNextView) ? (parsed.view as ShellNextView) : "none";

export const isShellNextMetadataOnlyProductArgv = (argv: readonly string[]): boolean => {
  if (argv.some((token) => metadataFlagTokens.has(token))) {
    return true;
  }
  const firstToken = argv[0];
  if (!firstToken) {
    return false;
  }
  if (metadataCommandTokens.has(firstToken)) {
    return true;
  }
  const secondToken = argv[1];
  return firstToken.startsWith("@") && secondToken !== undefined && metadataCommandTokens.has(secondToken);
};

export const createShellNextHelpText = async (argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Promise<string> =>
  await baseParser(argv, env).getHelp();

export const parseShellNextArgs = (
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): ShellNextParsedArgs => {
  const commandToken = argv[0] ?? "";
  const parsed = baseParser(argv, env).parseSync() as ShellNextBaseArgvParseResult;
  const base = toBaseProductArgs(parsed);

  if (localCommandTokens.has(commandToken)) {
    return {
      command: "renderer-grid-demo",
      selectionText: parsed.selectionText ?? "Drag across this selectable text to verify host selection inside pane.",
    };
  }
  if (tmuxActionCommandTokens.has(commandToken)) {
    const actionParsed = parsed as ShellNextTmuxActionArgvParseResult;
    return {
      command: "unsupported-tmux-action",
      action: actionParsed.action?.trim() || "unknown",
    };
  }
  if (cleanupCommandTokens.has(commandToken)) {
    return {
      command: "cleanup",
      host: parsed.host,
      port: parsed.port,
      authServiceEndpoint: parsed.authServiceEndpoint,
      shellName: typeof parsed.session === "string" ? normalizeShellNextShellName(parsed.session) : undefined,
      confirm: parsed.confirm === true,
    };
  }
  const legacyView = legacyViewCommandTokens.get(commandToken);
  if (legacyView) {
    throw new Error(
      `shell-next view commands moved to --view=${legacyView}; use --view=room|help|status|shell instead of positional '${commandToken}'`,
    );
  }
  if (parsed.command && parsed.command.length > 0) {
    return {
      command: "local",
      cwd: parsed.cwd ?? process.cwd(),
      shellCommand: parsed.command.map(String),
    };
  }
  const unexpected = parsed._.map(String).filter((item) => !item.startsWith("@"));
  if (unexpected.length > 0) {
    throw new Error(`unsupported shell-next command: ${unexpected[0]}`);
  }
  return {
    ...base,
    command: "attach",
    view: parseViewSelection(parsed),
  };
};
