import { basename, isAbsolute, resolve } from "node:path";
import { homedir } from "node:os";

import { resolveAvatarPromptPaths, resolveAvatarSources } from "@agenter/avatar";
import { loadSettings, type AiProviderKind, type TerminalBootEntry, type TerminalPresetSettings } from "@agenter/settings";

import { DEFAULT_LANGUAGE, resolveLanguage } from "./i18n";

export interface SessionTerminalConfig {
  terminalId: string;
  command: string[];
  commandLabel: string;
  cwd: string;
  submitGapMs?: number;
  outputRoot?: string;
  gitLog?: false | "normal" | "verbose";
  helpSource?: string;
}

export interface ResolvedSessionConfig {
  avatar: {
    nickname: string;
    sources: Array<{ name: string; path: string }>;
  };
  sessionStoreTarget: "global" | "workspace";
  lang: string;
  agentCwd: string;
  prompt: {
    rootDir?: string;
    agenterPath?: string;
    agenterSystemPath?: string;
    systemTemplatePath?: string;
    responseContractPath?: string;
  };
  ai: {
    providerId: string;
    kind: AiProviderKind;
    apiKey?: string;
    model: string;
    baseUrl?: string;
    temperature: number;
    maxRetries: number;
    maxToken?: number;
    compactThreshold?: number;
  };
  terminals: Record<string, SessionTerminalConfig>;
  primaryTerminalId: string;
  focusedTerminalId: string;
  bootTerminals: Array<{ terminalId: string; focus: boolean; autoRun: boolean }>;
  tasks: {
    sources: Array<{ name: string; path: string }>;
  };
}

const URI_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const isUriLike = (value: string): boolean => URI_PATTERN.test(value);

const toAbsolute = (value: string, baseDir: string): string => {
  if (isUriLike(value) || isAbsolute(value)) {
    return value;
  }
  return resolve(baseDir, value);
};

const deriveCliName = (command: string): string => {
  const name = basename(command).toLowerCase().replace(/(\.cmd|\.exe|\.bat|\.ps1)$/i, "");
  const normalized = name.replace(/[^a-z0-9_-]+/g, "");
  return normalized.length > 0 ? normalized : "agent";
};

const normalizeBootEntries = (
  configured: TerminalBootEntry[] | undefined,
  terminals: Record<string, SessionTerminalConfig>,
  primaryTerminalId: string,
): Array<{ terminalId: string; focus: boolean; autoRun: boolean }> => {
  const normalized = new Map<string, { terminalId: string; focus: boolean; autoRun: boolean }>();
  const source = configured ?? [primaryTerminalId];
  for (const entry of source) {
    const id = typeof entry === "string" ? entry : entry.id;
    if (!terminals[id] || normalized.has(id)) {
      continue;
    }
    normalized.set(id, {
      terminalId: id,
      focus: typeof entry === "object" ? entry.focus === true : false,
      autoRun: typeof entry === "object" ? entry.autoRun !== false : true,
    });
  }
  if (normalized.size === 0 && terminals[primaryTerminalId]) {
    normalized.set(primaryTerminalId, {
      terminalId: primaryTerminalId,
      focus: true,
      autoRun: true,
    });
  }
  const entries = [...normalized.values()];
  const focused = entries.find((entry) => entry.focus)?.terminalId ?? entries[0]?.terminalId ?? primaryTerminalId;
  return entries.map((entry) => ({
    ...entry,
    focus: entry.terminalId === focused,
  }));
};

const buildPresetFromLegacy = (
  terminalId: string,
  command: string[],
  terminalSettings: {
    submitGapMs?: number;
    helpSources?: Record<string, string>;
  },
): Record<string, TerminalPresetSettings> => {
  const cliName = deriveCliName(command[0] ?? "agent");
  const helpSource = terminalSettings.helpSources?.[terminalId] ?? terminalSettings.helpSources?.[cliName];
  return {
    [terminalId]: {
      command,
      submitGapMs: terminalSettings.submitGapMs,
      helpSource,
    },
  };
};

export const resolveSessionConfig = async (
  cwd: string,
  options: {
    avatar?: string;
  } = {},
): Promise<ResolvedSessionConfig> => {
  const loaded = await loadSettings({
    projectRoot: cwd,
    cwd,
    avatar: options.avatar,
  });
  const settings = loaded.settings;
  const terminalSettings = settings.terminal ?? {};
  const agentCwd = settings.agentCwd ? toAbsolute(settings.agentCwd, cwd) : cwd;

  let presets: Record<string, TerminalPresetSettings> = {};
  if (terminalSettings.presets && Object.keys(terminalSettings.presets).length > 0) {
    presets = { ...terminalSettings.presets };
  } else {
    const command = terminalSettings.command?.length ? [...terminalSettings.command] : [process.env.SHELL ?? "bash", "-i"];
    const terminalId = terminalSettings.terminalId ?? `${deriveCliName(command[0] ?? "terminal")}-main`;
    presets = buildPresetFromLegacy(terminalId, command, terminalSettings);
  }

  const presetIds = Object.keys(presets);
  const primaryTerminalId = terminalSettings.terminalId ?? presetIds[0] ?? "terminal-main";
  if (!presets[primaryTerminalId]) {
    presets[primaryTerminalId] = {
      command: [process.env.SHELL ?? "bash", "-i"],
    };
  }

  const terminals = Object.fromEntries(
    Object.entries(presets).map(([terminalId, preset]) => {
      const command = preset.command.length > 0 ? preset.command : [process.env.SHELL ?? "bash", "-i"];
      const cliName = deriveCliName(command[0] ?? "agent");
      const terminal: SessionTerminalConfig = {
        terminalId,
        command,
        commandLabel: command.join(" "),
        cwd: preset.cwd ? toAbsolute(preset.cwd, cwd) : agentCwd,
        submitGapMs: preset.submitGapMs,
        outputRoot: terminalSettings.outputRoot,
        gitLog: terminalSettings.gitLog,
        helpSource: preset.helpSource ?? terminalSettings.helpSources?.[terminalId] ?? terminalSettings.helpSources?.[cliName],
      };
      return [terminalId, terminal];
    }),
  );

  const bootTerminals = normalizeBootEntries(settings.features?.terminal?.bootTerminals, terminals, primaryTerminalId);
  const focusedTerminalId = bootTerminals.find((entry) => entry.focus)?.terminalId ?? primaryTerminalId;

  const prompt = settings.prompt ?? {};
  const avatar = resolveAvatarSources({
    nickname: settings.avatar,
    projectRoot: cwd,
    homeDir: homedir(),
  });
  const avatarPromptPaths = resolveAvatarPromptPaths(avatar);
  const promptRoot = prompt.rootDir ? toAbsolute(prompt.rootDir, cwd) : avatar.sources.at(-1)?.path;
  const ai = settings.ai ?? {};
  const providers = ai.providers ?? {};
  const defaultProviderId = ai.activeProvider ?? Object.keys(providers)[0] ?? "default";
  const provider = providers[defaultProviderId] ?? {
    kind: "deepseek" as const,
    model: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
    temperature: 0.2,
    maxRetries: 2,
    maxToken: 64_000,
    compactThreshold: 0.75,
  };
  const resolvedApiKey = provider.apiKey ?? (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined);

  return {
    avatar,
    sessionStoreTarget: settings.sessionStoreTarget ?? "global",
    lang: resolveLanguage(settings.lang ?? DEFAULT_LANGUAGE),
    agentCwd,
    prompt: {
      rootDir: promptRoot,
      agenterPath: prompt.agenterPath ?? avatarPromptPaths.AGENTER,
      agenterSystemPath: prompt.internalSystemPath ?? avatarPromptPaths.AGENTER_SYSTEM,
      systemTemplatePath: prompt.systemTemplatePath ?? avatarPromptPaths.SYSTEM_TEMPLATE,
      responseContractPath: prompt.responseContractPath ?? avatarPromptPaths.RESPONSE_CONTRACT,
    },
    ai: {
      providerId: defaultProviderId,
      kind: provider.kind,
      apiKey: resolvedApiKey,
      model: provider.model,
      baseUrl: provider.baseUrl,
      temperature: provider.temperature ?? 0.2,
      maxRetries: provider.maxRetries ?? 2,
      maxToken: provider.maxToken,
      compactThreshold: provider.compactThreshold,
    },
    terminals,
    primaryTerminalId,
    focusedTerminalId,
    bootTerminals,
    tasks: {
      sources: settings.tasks?.sources ?? [
        { name: "user", path: resolve(homedir(), ".agenter", "tasks") },
        { name: "workspace", path: resolve(agentCwd, ".agenter", "tasks") },
      ],
    },
  };
};
