import { basename, dirname, isAbsolute, resolve } from "node:path";
import { DEFAULT_LANGUAGE, resolveLanguage } from "@agenter/app-server";
import {
  loadSettings,
  type AiProviderKind,
  type SettingsSourceInput,
  type TerminalBootEntry,
  type TerminalPresetSettings,
} from "@agenter/settings";

export interface TerminalRuntimeConfig {
  terminalId: string;
  command: string[];
  commandLabel: string;
  cwd: string;
  submitGapMs?: number;
  outputRoot?: string;
  gitLog?: false | "normal" | "verbose";
  helpSource?: string;
}

export interface RuntimeConfig {
  lang: string;
  agentCwd: string;
  primaryTerminalId: string;
  focusedTerminalId: string;
  bootTerminals: Array<{
    terminalId: string;
    focus: boolean;
    autoRun: boolean;
  }>;
  terminals: Record<string, TerminalRuntimeConfig>;
  terminal: TerminalRuntimeConfig;
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
  features: {
    terminal: {
      focusMode: "exclusive";
      unfocusedSignal: "summary";
    };
  };
  settingsMeta: {
    sources: Array<{
      id: string;
      path: string;
      exists: boolean;
      error?: string;
    }>;
  };
}

const URI_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const isUriLike = (value: string): boolean => URI_PATTERN.test(value);

const toAbsolute = (value: string, baseDir: string): string => {
  if (isUriLike(value)) {
    return value;
  }
  if (isAbsolute(value)) {
    return value;
  }
  return resolve(baseDir, value);
};

const splitCommand = (input: string): string[] => {
  const parts: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        token += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (token.length > 0) {
        parts.push(token);
        token = "";
      }
      continue;
    }
    token += char;
  }

  if (token.length > 0) {
    parts.push(token);
  }
  return parts;
};

const parseCommandValue = (value: string): string[] => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return [];
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  return splitCommand(trimmed);
};

const sanitizeId = (value: string): string => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "terminal";
};

const deriveCliName = (command: string): string => {
  const name = basename(command).toLowerCase().replace(/(\.cmd|\.exe|\.bat|\.ps1)$/i, "");
  const normalized = name.replace(/[^a-z0-9_-]+/g, "");
  return normalized.length > 0 ? normalized : "agent";
};

const parseGitLogArg = (value: string | undefined): false | "normal" | "verbose" | null => {
  if (value === undefined) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized === "true" || normalized === "on" || normalized === "yes") {
    return "normal";
  }
  if (normalized === "off" || normalized === "false" || normalized === "none" || normalized === "no") {
    return false;
  }
  if (normalized === "normal" || normalized === "verbose") {
    return normalized;
  }
  return null;
};

const derivePromptRootFromSettingsPath = (value: string): string => {
  if (value.startsWith("file://")) {
    return dirname(new URL(value).pathname);
  }
  if (isUriLike(value)) {
    return value.replace(/\/[^/]*$/, "/");
  }
  return dirname(value);
};

interface CliOverrides {
  cwd?: string;
  command?: string[];
  terminalId?: string;
  submitGapMs?: number;
  outputRoot?: string;
  gitLog?: false | "normal" | "verbose";
}

const parseCliOverrides = (argv: string[], baseDir: string): CliOverrides => {
  const overrides: CliOverrides = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--cwd") {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        overrides.cwd = toAbsolute(next, baseDir);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--cwd=")) {
      overrides.cwd = toAbsolute(arg.slice("--cwd=".length), baseDir);
      continue;
    }
    if (arg === "--cmd") {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        const parsed = parseCommandValue(next);
        if (parsed.length > 0) {
          overrides.command = parsed;
        }
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--cmd=")) {
      const parsed = parseCommandValue(arg.slice("--cmd=".length));
      if (parsed.length > 0) {
        overrides.command = parsed;
      }
      continue;
    }
    if (arg === "--terminal-id") {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        overrides.terminalId = sanitizeId(next);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--terminal-id=")) {
      overrides.terminalId = sanitizeId(arg.slice("--terminal-id=".length));
      continue;
    }
    if (arg === "--submit-gap-ms") {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        const parsed = Number.parseInt(next, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          overrides.submitGapMs = parsed;
        }
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--submit-gap-ms=")) {
      const parsed = Number.parseInt(arg.slice("--submit-gap-ms=".length), 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        overrides.submitGapMs = parsed;
      }
      continue;
    }
    if (arg === "--ati-output-dir") {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        overrides.outputRoot = toAbsolute(next, baseDir);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--ati-output-dir=")) {
      overrides.outputRoot = toAbsolute(arg.slice("--ati-output-dir=".length), baseDir);
      continue;
    }
    if (arg === "--git-log") {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        const parsed = parseGitLogArg(next);
        if (parsed !== null) {
          overrides.gitLog = parsed;
          index += 1;
          continue;
        }
      }
      overrides.gitLog = "normal";
      continue;
    }
    if (arg.startsWith("--git-log=")) {
      const parsed = parseGitLogArg(arg.slice("--git-log=".length));
      if (parsed !== null) {
        overrides.gitLog = parsed;
      }
      continue;
    }
  }
  return overrides;
};

const normalizeBootEntries = (
  configured: TerminalBootEntry[] | undefined,
  terminals: Record<string, TerminalRuntimeConfig>,
  primaryTerminalId: string,
): Array<{ terminalId: string; focus: boolean; autoRun: boolean }> => {
  const normalized = new Map<string, { terminalId: string; focus: boolean; autoRun: boolean }>();
  const source = configured ?? [primaryTerminalId];
  for (const entry of source) {
    const id = typeof entry === "string" ? entry : entry.id;
    if (!terminals[id]) {
      continue;
    }
    if (normalized.has(id)) {
      continue;
    }
    normalized.set(id, {
      terminalId: id,
      focus: typeof entry === "object" ? entry.focus === true : false,
      autoRun: typeof entry === "object" ? entry.autoRun !== false : true,
    });
  }
  if (normalized.size === 0 && terminals[primaryTerminalId]) {
    normalized.set(primaryTerminalId, { terminalId: primaryTerminalId, focus: true, autoRun: true });
  }
  const entries = [...normalized.values()];
  const focusTarget = entries.find((entry) => entry.focus)?.terminalId ?? entries[0]?.terminalId ?? primaryTerminalId;
  return entries.map((entry) => ({
    ...entry,
    focus: entry.terminalId === focusTarget,
  }));
};

const buildPresetFromLegacy = (
  terminalId: string,
  command: string[],
  terminalSettings: {
    submitGapMs?: number;
    outputRoot?: string;
    gitLog?: false | "normal" | "verbose";
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

export const parseRuntimeConfig = async (argv: string[], baseDir: string): Promise<RuntimeConfig> => {
  const settingsSources: SettingsSourceInput[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--settings-source") {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        settingsSources.push(next);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--settings-source=")) {
      const value = arg.slice("--settings-source=".length).trim();
      if (value.length > 0) {
        settingsSources.push(value);
      }
      continue;
    }
  }

  const loadedSettings = await loadSettings({
    projectRoot: baseDir,
    cwd: baseDir,
    sources: settingsSources.length > 0 ? settingsSources : undefined,
  });
  const settings = loadedSettings.settings;
  const overrides = parseCliOverrides(argv, baseDir);
  const envCommand = parseCommandValue(process.env.AGENTER_TERMINAL_CMD ?? "");

  const agentCwd = overrides.cwd ?? (settings.agentCwd ? toAbsolute(settings.agentCwd, baseDir) : baseDir);
  const terminalSettings = settings.terminal ?? {};

  let presets: Record<string, TerminalPresetSettings> = {};
  if (terminalSettings.presets && Object.keys(terminalSettings.presets).length > 0) {
    presets = { ...terminalSettings.presets };
  } else {
    let command = terminalSettings.command ? [...terminalSettings.command] : [];
    if (envCommand.length > 0) {
      command = envCommand;
    }
    if (overrides.command && overrides.command.length > 0) {
      command = overrides.command;
    }
    if (command.length === 0) {
      const shell = process.env.SHELL ?? "bash";
      command = [shell, "-i"];
    }
    const id = overrides.terminalId ?? terminalSettings.terminalId ?? `${sanitizeId(command[0] ?? "terminal")}-main`;
    presets = buildPresetFromLegacy(id, command, terminalSettings);
  }

  const presetIds = Object.keys(presets);
  const fallbackPrimary = presetIds[0] ?? "terminal-main";
  const primaryTerminalId = overrides.terminalId ?? terminalSettings.terminalId ?? fallbackPrimary;

  if (!presets[primaryTerminalId]) {
    const command =
      overrides.command && overrides.command.length > 0
        ? overrides.command
        : envCommand.length > 0
          ? envCommand
          : [process.env.SHELL ?? "bash", "-i"];
    presets[primaryTerminalId] = {
      command,
      submitGapMs: overrides.submitGapMs ?? terminalSettings.submitGapMs,
      helpSource:
        terminalSettings.helpSources?.[primaryTerminalId] ??
        terminalSettings.helpSources?.[deriveCliName(command[0] ?? "agent")],
    };
  }

  const primaryPreset = presets[primaryTerminalId];
  if (overrides.command && overrides.command.length > 0) {
    primaryPreset.command = overrides.command;
  }
  if (envCommand.length > 0 && !overrides.command) {
    primaryPreset.command = envCommand;
  }
  if (overrides.submitGapMs !== undefined) {
    primaryPreset.submitGapMs = overrides.submitGapMs;
  }

  const terminals = Object.fromEntries(
    Object.entries(presets).map(([terminalId, preset]) => {
      const command = preset.command.length > 0 ? preset.command : [process.env.SHELL ?? "bash", "-i"];
      const cliName = deriveCliName(command[0] ?? "agent");
      const runtime: TerminalRuntimeConfig = {
        terminalId,
        command,
        commandLabel: command.join(" "),
        cwd: preset.cwd ? toAbsolute(preset.cwd, baseDir) : agentCwd,
        submitGapMs: preset.submitGapMs,
        outputRoot: overrides.outputRoot ?? terminalSettings.outputRoot,
        gitLog: overrides.gitLog ?? terminalSettings.gitLog,
        helpSource: preset.helpSource ?? terminalSettings.helpSources?.[terminalId] ?? terminalSettings.helpSources?.[cliName],
      };
      return [terminalId, runtime];
    }),
  );

  const configuredBoot = settings.features?.terminal?.bootTerminals;
  const bootTerminals = normalizeBootEntries(configuredBoot, terminals, primaryTerminalId);
  const focusedTerminalId = bootTerminals.find((entry) => entry.focus)?.terminalId ?? primaryTerminalId;

  const prompt = settings.prompt ?? {};
  const firstSettingsPath = loadedSettings.meta.sources.find((source) => source.exists)?.path;
  const promptRoot = prompt.rootDir
    ? toAbsolute(prompt.rootDir, baseDir)
    : firstSettingsPath
      ? derivePromptRootFromSettingsPath(firstSettingsPath)
      : undefined;

  const ai = settings.ai ?? {};
  const providers = ai.providers ?? {};
  const providerId = ai.activeProvider ?? Object.keys(providers)[0] ?? "default";
  const provider = providers[providerId] ?? {
    kind: "openai-compatible" as const,
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    temperature: 0.2,
    maxRetries: 2,
    maxToken: 64_000,
    compactThreshold: 0.75,
  };
  const terminalFeatures = settings.features?.terminal ?? {};
  const apiKey = provider.apiKey ?? (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined);

  const promptConfig = {
    rootDir: promptRoot,
    agenterPath: prompt.agenterPath ?? (promptRoot ? `${promptRoot.replace(/\/$/, "")}/AGENTER.mdx` : undefined),
    agenterSystemPath:
      prompt.internalSystemPath ??
      (promptRoot ? `${promptRoot.replace(/\/$/, "")}/internal/AGENTER_SYSTEM.mdx` : undefined),
    systemTemplatePath:
      prompt.systemTemplatePath ?? (promptRoot ? `${promptRoot.replace(/\/$/, "")}/internal/SYSTEM_TEMPLATE.mdx` : undefined),
    responseContractPath:
      prompt.responseContractPath ??
      (promptRoot ? `${promptRoot.replace(/\/$/, "")}/internal/RESPONSE_CONTRACT.mdx` : undefined),
  };

  return {
    lang: resolveLanguage(settings.lang ?? DEFAULT_LANGUAGE),
    agentCwd,
    primaryTerminalId,
    focusedTerminalId,
    bootTerminals,
    terminals,
    terminal: terminals[primaryTerminalId],
    prompt: promptConfig,
    ai: {
      providerId,
      kind: provider.kind,
      apiKey,
      model: provider.model,
      baseUrl: provider.baseUrl,
      temperature: provider.temperature ?? 0.2,
      maxRetries: provider.maxRetries ?? 2,
      maxToken: provider.maxToken,
      compactThreshold: provider.compactThreshold,
    },
    features: {
      terminal: {
        focusMode: terminalFeatures.focusMode ?? "exclusive",
        unfocusedSignal: terminalFeatures.unfocusedSignal ?? "summary",
      },
    },
    settingsMeta: loadedSettings.meta,
  };
};
