import yargs from "yargs";

const metadataFlagTokens = new Set(["--help", "-h", "--version", "-v"]);
const metadataCommandTokens = new Set(["help", "version"]);
const localCommandTokens = new Set(["renderer-grid-demo"]);
const cleanupCommandTokens = new Set(["cleanup", "clean"]);
const tmuxActionCommandTokens = new Set(["tmux-action"]);
const legacyViewCommandTokens = new Map<string, ShellView>([
  ["room", "room"],
  ["chat", "room"],
  ["help-panel", "help"],
  ["top", "status"],
  ["notifications", "status"],
  ["shell", "shell"],
  ["terminal", "shell"],
  ["heartbeat-status", "status"],
]);

export const SHELL_DEFAULT_AVATAR = "shell-assistant";
export const SHELL_DEFAULT_SESSION = "1";
export type ShellView = "none" | "room" | "help" | "status" | "shell";
const shellViewChoices = ["none", "room", "help", "status", "shell"] as const satisfies readonly ShellView[];

interface ShellBaseArgvParseResult {
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

interface ShellTmuxActionArgvParseResult extends ShellBaseArgvParseResult {
  action?: string;
}

export interface ShellBaseProductArgs {
  readonly host: string;
  readonly port: number;
  readonly authServiceEndpoint?: string;
  readonly shellName: string;
  readonly avatarNickname: string;
  readonly createAvatar: boolean;
  readonly clearAvatar: boolean;
}

export interface ShellAttachArgs extends ShellBaseProductArgs {
  readonly command: "attach";
  readonly view: ShellView;
  readonly sessionExplicit: boolean;
  readonly avatarExplicit: boolean;
}

export interface ShellCleanupArgs {
  readonly command: "cleanup";
  readonly host: string;
  readonly port: number;
  readonly authServiceEndpoint?: string;
  readonly shellName?: string;
  readonly confirm: boolean;
}

export interface ShellLocalArgs {
  readonly command: "local";
  readonly cwd: string;
  readonly shellCommand?: readonly string[];
}

export interface ShellRendererGridDemoArgs {
  readonly command: "renderer-grid-demo";
  readonly selectionText: string;
}

export interface ShellUnsupportedTmuxActionArgs {
  readonly command: "unsupported-tmux-action";
  readonly action: string;
}

export type ShellParsedArgs =
  | ShellAttachArgs
  | ShellCleanupArgs
  | ShellLocalArgs
  | ShellRendererGridDemoArgs
  | ShellUnsupportedTmuxActionArgs;

export const normalizeShellName = (value: string | undefined): string => {
  const trimmed = value?.trim() || SHELL_DEFAULT_SESSION;
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

const parseAvatarSelection = (parsed: ShellBaseArgvParseResult): {
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
    avatarNickname: flagAvatar ?? mentionAvatar ?? SHELL_DEFAULT_AVATAR,
    avatarExplicit: flagAvatar !== undefined || mentionAvatar !== undefined,
  };
};

const baseParser = (argv: readonly string[], env: NodeJS.ProcessEnv, scriptName = "agenter-shell") =>
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
      choices: [...shellViewChoices],
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

const toBaseProductArgs = (parsed: ShellBaseArgvParseResult): ShellBaseProductArgs & {
  sessionExplicit: boolean;
  avatarExplicit: boolean;
} => {
  const avatar = parseAvatarSelection(parsed);
  return {
    host: parsed.host,
    port: parsed.port,
    authServiceEndpoint: parsed.authServiceEndpoint,
    shellName: normalizeShellName(typeof parsed.session === "string" ? parsed.session : undefined),
    avatarNickname: avatar.avatarNickname,
    createAvatar: parsed.createAvatar === true,
    clearAvatar: parsed.clearAvatar === true,
    sessionExplicit: typeof parsed.session === "string" && parsed.session.trim().length > 0,
    avatarExplicit: avatar.avatarExplicit,
  };
};

const parseViewSelection = (parsed: ShellBaseArgvParseResult): ShellView =>
  shellViewChoices.includes(parsed.view as ShellView) ? (parsed.view as ShellView) : "none";

export const isShellMetadataOnlyProductArgv = (argv: readonly string[]): boolean => {
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

export const createShellHelpText = async (argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Promise<string> =>
  await baseParser(argv, env).getHelp();

export const parseShellArgs = (
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): ShellParsedArgs => {
  const commandToken = argv[0] ?? "";
  const parsed = baseParser(argv, env).parseSync() as ShellBaseArgvParseResult;
  const base = toBaseProductArgs(parsed);

  if (localCommandTokens.has(commandToken)) {
    return {
      command: "renderer-grid-demo",
      selectionText: parsed.selectionText ?? "Drag across this selectable text to verify host selection inside pane.",
    };
  }
  if (tmuxActionCommandTokens.has(commandToken)) {
    const actionParsed = parsed as ShellTmuxActionArgvParseResult;
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
      shellName: typeof parsed.session === "string" ? normalizeShellName(parsed.session) : undefined,
      confirm: parsed.confirm === true,
    };
  }
  const legacyView = legacyViewCommandTokens.get(commandToken);
  if (legacyView) {
    throw new Error(
      `shell view commands moved to --view=${legacyView}; use --view=room|help|status|shell instead of positional '${commandToken}'`,
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
    throw new Error(`unsupported shell command: ${unexpected[0]}`);
  }
  return {
    ...base,
    command: "attach",
    view: parseViewSelection(parsed),
  };
};
