import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";

import { resolveAvatarPromptPaths, resolveAvatarSources, resolveGlobalAvatarCanonicalRoot } from "@agenter/avatar";
import {
  loadSettings,
  resolveLoopCompactPolicy,
  resolveLoopRetryPolicy,
  type AiApiStandard,
  type ResolvedLoopCompactPolicy,
  type ResolvedLoopRetryPolicy,
  type TerminalBootEntry,
  type TerminalPresetSettings,
} from "@agenter/settings";
import { resolveDefaultInteractiveShellCommand } from "@agenter/terminal-system";

import { DEFAULT_LANGUAGE, resolveLanguage } from "./i18n";
import type { PromptRootLayer } from "./prompt-store";

export interface SessionTerminalConfig {
  terminalId: string;
  command: string[];
  commandLabel: string;
  cwd: string;
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
    publicRootDir?: string;
    privateRootDir?: string;
    globalRootDir?: string;
    promptLayers: PromptRootLayer[];
    agenterPath?: string;
  };
  ai: {
    providerId: string;
    apiStandard: AiApiStandard;
    vendor?: string;
    profile?: string;
    extensions?: string[];
    apiKey?: string;
    apiKeyEnv?: string;
    model: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    temperature: number;
    topK?: number;
    transportMaxRetries: number;
    maxToken?: number;
    maxContextTokens?: number;
    thinking?: {
      enabled?: boolean;
      budgetTokens?: number;
    };
  };
  loop: {
    retryPolicy: ResolvedLoopRetryPolicy;
    compactPolicy: ResolvedLoopCompactPolicy;
  };
  terminals: Record<string, SessionTerminalConfig>;
  primaryTerminalId: string;
  focusedTerminalIds: string[];
  bootTerminals: Array<{ terminalId: string; focus: boolean; autoRun: boolean }>;
  tasks: {
    sources: Array<{ name: string; path: string }>;
  };
  message: {
    chatMainDefaults?: {
      title?: string;
      participants?: Array<{
        id: string;
        label?: string;
      }>;
      metadata?: Record<string, unknown>;
      adminToken?: string;
    };
    maxFocusedRoomCount: number;
    maxBatchReadRoomMessageCount: number;
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
  const name = basename(command)
    .toLowerCase()
    .replace(/(\.cmd|\.exe|\.bat|\.ps1)$/i, "");
  const normalized = name.replace(/[^a-z0-9_-]+/g, "");
  return normalized.length > 0 ? normalized : "agent";
};

const normalizeBootEntries = (
  configured: TerminalBootEntry[] | undefined,
  terminals: Record<string, SessionTerminalConfig>,
  primaryTerminalId: string,
): Array<{ terminalId: string; focus: boolean; autoRun: boolean }> => {
  const useDefaultBoot = configured === undefined;
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
  if (normalized.size === 0 && useDefaultBoot && terminals[primaryTerminalId]) {
    normalized.set(primaryTerminalId, {
      terminalId: primaryTerminalId,
      focus: true,
      autoRun: true,
    });
  }
  const entries = [...normalized.values()];
  if (entries.length === 0) {
    return entries;
  }
  if (entries.some((entry) => entry.focus)) {
    return entries;
  }
  const fallback = entries[0]?.terminalId ?? primaryTerminalId;
  return entries.map((entry) => ({
    ...entry,
    focus: entry.terminalId === fallback,
  }));
};

const buildPresetFromLegacy = (
  terminalId: string,
  command: string[],
  terminalSettings: {
    helpSources?: Record<string, string>;
  },
): Record<string, TerminalPresetSettings> => {
  const cliName = deriveCliName(command[0] ?? "agent");
  const helpSource = terminalSettings.helpSources?.[terminalId] ?? terminalSettings.helpSources?.[cliName];
  return {
    [terminalId]: {
      command,
      helpSource,
    },
  };
};

export const resolveSessionConfig = async (
  cwd: string,
  options: {
    avatar?: string;
    avatarPrincipalId?: string;
    homeDir?: string;
  } = {},
): Promise<ResolvedSessionConfig> => {
  const homeDir = options.homeDir ?? homedir();
  const loaded = await loadSettings({
    projectRoot: cwd,
    cwd,
    avatar: options.avatar,
    homeDir,
  });
  const settings = loaded.settings;
  const terminalSettings = settings.terminal ?? {};
  const agentCwd = settings.agentCwd ? toAbsolute(settings.agentCwd, cwd) : cwd;

  let presets: Record<string, TerminalPresetSettings> = {};
  if (terminalSettings.presets && Object.keys(terminalSettings.presets).length > 0) {
    presets = { ...terminalSettings.presets };
  } else {
    const command = terminalSettings.command?.length
      ? [...terminalSettings.command]
      : resolveDefaultInteractiveShellCommand();
    const terminalId = terminalSettings.terminalId ?? `${deriveCliName(command[0] ?? "terminal")}-main`;
    presets = buildPresetFromLegacy(terminalId, command, terminalSettings);
  }

  const presetIds = Object.keys(presets);
  const primaryTerminalId = terminalSettings.terminalId ?? presetIds[0] ?? "terminal-main";
  if (!presets[primaryTerminalId]) {
    presets[primaryTerminalId] = {
      command: resolveDefaultInteractiveShellCommand(),
    };
  }

  const terminals = Object.fromEntries(
    Object.entries(presets).map(([terminalId, preset]) => {
      const command = preset.command.length > 0 ? preset.command : resolveDefaultInteractiveShellCommand();
      const cliName = deriveCliName(command[0] ?? "agent");
      const terminal: SessionTerminalConfig = {
        terminalId,
        command,
        commandLabel: command.join(" "),
        cwd: preset.cwd ? toAbsolute(preset.cwd, cwd) : agentCwd,
        outputRoot: terminalSettings.outputRoot,
        gitLog: terminalSettings.gitLog,
        helpSource:
          preset.helpSource ?? terminalSettings.helpSources?.[terminalId] ?? terminalSettings.helpSources?.[cliName],
      };
      return [terminalId, terminal];
    }),
  );

  const bootTerminals = normalizeBootEntries(settings.features?.terminal?.bootTerminals, terminals, primaryTerminalId);
  const focusedTerminalIds = bootTerminals.filter((entry) => entry.focus).map((entry) => entry.terminalId);

  const avatar = resolveAvatarSources({
    nickname: settings.avatar,
    principalId: options.avatarPrincipalId,
    homeDir,
  });
  const avatarPromptPaths = resolveAvatarPromptPaths(avatar);
  const globalPrivateRoot = options.avatarPrincipalId
    ? resolveGlobalAvatarCanonicalRoot(options.avatarPrincipalId, homeDir)
    : avatar.sources.at(-1)?.path;
  const promptRoot = globalPrivateRoot;
  const globalRootDir = join(homeDir, ".agenter");
  const publicRootDir = globalRootDir;
  const lang = resolveLanguage(settings.lang ?? DEFAULT_LANGUAGE);
  const promptLayers = promptRoot
    ? [
        {
          publicRootDir: globalRootDir,
          privateRootDir: promptRoot,
        },
      ]
    : [];
  const ai = settings.ai ?? {};
  const providers = ai.providers ?? {};
  const defaultProviderId = ai.activeProvider ?? Object.keys(providers)[0] ?? "default";
  const provider = providers[defaultProviderId] ?? {
    apiStandard: "openai-chat" as const,
    vendor: "deepseek",
    model: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
    maxRetries: 2,
  };
  const resolvedApiKey = provider.apiKey ?? (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined);
  const retryPolicy = resolveLoopRetryPolicy(settings.loop?.retryPolicy);
  const compactPolicy = resolveLoopCompactPolicy(settings.loop?.compactPolicy, {
    compactThreshold: provider.compactThreshold ?? null,
  });

  return {
    avatar,
    sessionStoreTarget: settings.sessionStoreTarget ?? "global",
    lang,
    agentCwd,
    prompt: {
      rootDir: promptRoot,
      publicRootDir,
      privateRootDir: promptRoot,
      globalRootDir,
      promptLayers,
      agenterPath: promptRoot ? join(promptRoot, "AGENTER.mdx") : avatarPromptPaths.AGENTER,
    },
    ai: {
      providerId: defaultProviderId,
      apiStandard: provider.apiStandard,
      vendor: provider.vendor,
      profile: provider.profile,
      extensions: provider.extensions,
      apiKey: resolvedApiKey,
      apiKeyEnv: provider.apiKeyEnv,
      model: provider.model,
      baseUrl: provider.baseUrl,
      headers: provider.headers,
      temperature: ai.temperature ?? 0.2,
      topK: ai.topK,
      transportMaxRetries: provider.maxRetries ?? 2,
      maxToken: ai.maxToken,
      maxContextTokens: provider.maxContextTokens,
      thinking: ai.thinking,
    },
    loop: {
      retryPolicy,
      compactPolicy,
    },
    terminals,
    primaryTerminalId,
    focusedTerminalIds: focusedTerminalIds.length > 0 ? focusedTerminalIds : [primaryTerminalId],
    bootTerminals,
    tasks: {
      sources: settings.tasks?.sources ?? [],
    },
    message: {
      chatMainDefaults: settings.features?.message?.chatMainDefaults
        ? {
            title: settings.features.message.chatMainDefaults.title,
            participants: settings.features.message.chatMainDefaults.participants?.map((participant) => ({
              id: participant.id,
              label: participant.label,
            })),
            metadata: settings.features.message.chatMainDefaults.metadata,
            adminToken: settings.features.message.chatMainDefaults.adminToken,
          }
        : undefined,
      maxFocusedRoomCount: settings.features?.message?.maxFocusedRoomCount ?? 3,
      maxBatchReadRoomMessageCount: settings.features?.message?.maxBatchReadRoomMessageCount ?? 20,
    },
  };
};
