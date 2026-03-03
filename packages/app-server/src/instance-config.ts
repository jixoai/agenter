import { basename, isAbsolute, resolve } from "node:path";

import { loadSettings, type TerminalBootEntry, type TerminalPresetSettings } from "@agenter/settings";

import { DEFAULT_LANGUAGE, resolveLanguage } from "./i18n";

export interface InstanceTerminalConfig {
  terminalId: string;
  command: string[];
  commandLabel: string;
  cwd: string;
  submitGapMs?: number;
  outputRoot?: string;
  gitLog?: false | "normal" | "verbose";
  helpSource?: string;
}

export interface ResolvedInstanceConfig {
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
    provider: "deepseek";
    apiKey?: string;
    model: string;
    baseUrl: string;
    temperature: number;
    maxRetries: number;
  };
  terminals: Record<string, InstanceTerminalConfig>;
  primaryTerminalId: string;
  focusedTerminalId: string;
  bootTerminals: Array<{ terminalId: string; focus: boolean; autoRun: boolean }>;
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
  terminals: Record<string, InstanceTerminalConfig>,
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

export const resolveInstanceConfig = async (cwd: string): Promise<ResolvedInstanceConfig> => {
  const loaded = await loadSettings({
    projectRoot: cwd,
    cwd,
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
      const terminal: InstanceTerminalConfig = {
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
  const promptRoot = prompt.rootDir ? toAbsolute(prompt.rootDir, cwd) : resolve(cwd, ".agenter");
  const ai = settings.ai ?? {};

  return {
    lang: resolveLanguage(settings.lang ?? DEFAULT_LANGUAGE),
    agentCwd,
    prompt: {
      rootDir: promptRoot,
      agenterPath: prompt.agenterPath ?? resolve(promptRoot, "AGENTER.mdx"),
      agenterSystemPath: prompt.internalSystemPath ?? resolve(promptRoot, "internal", "AGENTER_SYSTEM.mdx"),
      systemTemplatePath: prompt.systemTemplatePath ?? resolve(promptRoot, "internal", "SYSTEM_TEMPLATE.mdx"),
      responseContractPath: prompt.responseContractPath ?? resolve(promptRoot, "internal", "RESPONSE_CONTRACT.mdx"),
    },
    ai: {
      provider: ai.provider ?? "deepseek",
      apiKey: ai.apiKey ?? (ai.apiKeyEnv ? process.env[ai.apiKeyEnv] : undefined) ?? process.env.DEEPSEEK_API_KEY,
      model: ai.model ?? "deepseek-chat",
      baseUrl: ai.baseUrl ?? "https://api.deepseek.com/v1",
      temperature: ai.temperature ?? 0.2,
      maxRetries: ai.maxRetries ?? 2,
    },
    terminals,
    primaryTerminalId,
    focusedTerminalId,
    bootTerminals,
  };
};
