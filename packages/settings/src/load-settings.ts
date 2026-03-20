import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { defaultAvatarNickname, resolveAvatarLayerSettingsPath } from "@agenter/avatar";

import { deepMerge } from "./merge";
import { ResourceLoader } from "./resource-loader";
import { settingsSchema } from "./schema";
import { settingsSource } from "./source";
import type { AgenterSettings, LoadSettingsOptions, LoadedSettings, SettingsSourceInput } from "./types";

const defaultSettings = (): AgenterSettings => ({
  settingsSource: ["user", "project", "local"],
  avatar: defaultAvatarNickname(),
  sessionStoreTarget: "global",
  lang: "en",
  loop: {
    sliceDirty: {
      wait: false,
      timeoutMs: 30_000,
      pollMs: 250,
    },
  },
  ai: {
    activeProvider: "default",
    providers: {
      default: {
        apiStandard: "openai-chat",
        vendor: "deepseek",
        model: "deepseek-chat",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        baseUrl: "https://api.deepseek.com/v1",
        temperature: 0.2,
        maxRetries: 2,
        maxToken: 64_000,
        compactThreshold: 0.75,
      },
    },
  },
  tasks: {
    sources: [
      { name: "user", path: "~/.agenter/tasks" },
      { name: "workspace", path: ".agenter/tasks" },
    ],
  },
});

const parseJsonText = (text: string): AgenterSettings => {
  const parsed = JSON.parse(text) as unknown;
  return settingsSchema.parse(parsed) as AgenterSettings;
};

const URI_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

const isUriLike = (value: string): boolean => URI_PATTERN.test(value);

const toAbsMaybeUri = (value: string | undefined, projectRoot: string, homeDir: string): string | undefined => {
  if (!value) {
    return value;
  }
  if (value === "~") {
    return homeDir;
  }
  if (value.startsWith("~/")) {
    return join(homeDir, value.slice(2));
  }
  if (value.startsWith("/")) {
    return value;
  }
  if (isUriLike(value)) {
    return value;
  }
  return resolve(projectRoot, value);
};

const normalizeSettingsPaths = (settings: AgenterSettings, projectRoot: string, homeDir: string): AgenterSettings => {
  const prompt = settings.prompt;
  const terminal = settings.terminal;
  const tasks = settings.tasks;

  const normalizedHelpSources = terminal?.helpSources
    ? Object.fromEntries(
        Object.entries(terminal.helpSources).map(([key, value]) => [
          key,
          toAbsMaybeUri(value, projectRoot, homeDir) ?? value,
        ]),
      )
    : undefined;

  const normalizedPresets = terminal?.presets
    ? Object.fromEntries(
        Object.entries(terminal.presets).map(([key, value]) => [
          key,
          {
            ...value,
            cwd: toAbsMaybeUri(value.cwd, projectRoot, homeDir),
            helpSource: toAbsMaybeUri(value.helpSource, projectRoot, homeDir),
          },
        ]),
      )
    : undefined;

  return {
    ...settings,
    prompt: prompt
      ? {
          ...prompt,
          rootDir: toAbsMaybeUri(prompt.rootDir, projectRoot, homeDir),
          agenterPath: toAbsMaybeUri(prompt.agenterPath, projectRoot, homeDir),
          internalSystemPath: toAbsMaybeUri(prompt.internalSystemPath, projectRoot, homeDir),
          systemTemplatePath: toAbsMaybeUri(prompt.systemTemplatePath, projectRoot, homeDir),
          responseContractPath: toAbsMaybeUri(prompt.responseContractPath, projectRoot, homeDir),
        }
      : undefined,
    terminal: terminal
      ? {
          ...terminal,
          outputRoot: toAbsMaybeUri(terminal.outputRoot, projectRoot, homeDir),
          presets: normalizedPresets,
          helpSources: normalizedHelpSources as Record<string, string> | undefined,
        }
      : undefined,
    tasks: tasks
      ? {
          ...tasks,
          sources: tasks.sources?.map((source) => ({
            ...source,
            path: toAbsMaybeUri(source.path, projectRoot, homeDir) ?? source.path,
          })),
        }
      : undefined,
  };
};

const classifyMissingResource = (errorMessage: string): boolean => {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("enoent") || normalized.includes("not found") || normalized.includes("request failed (404)")
  );
};

const isLocalPath = (value: string): boolean => value.startsWith("/") || value.startsWith("~");

export const loadSettings = async (options: LoadSettingsOptions): Promise<LoadedSettings> => {
  const homeDir = options.homeDir ?? homedir();
  const loader =
    options.loader ??
    new ResourceLoader({
      context: {
        projectRoot: options.projectRoot,
        cwd: options.cwd,
        homeDir,
      },
    });
  let settings = defaultSettings();
  if (options.avatar?.trim()) {
    settings.avatar = options.avatar.trim();
  }

  const inputSources: SettingsSourceInput[] = options.sources ??
    settings.settingsSource ?? ["user", "project", "local"];
  const descriptors = settingsSource(inputSources, {
    projectRoot: options.projectRoot,
    cwd: options.cwd,
    homeDir,
    loader,
  });

  const meta: LoadedSettings["meta"] = {
    sources: [],
  };

  let activeAvatar = options.avatar?.trim() || settings.avatar || defaultAvatarNickname();
  const appliedAvatarLayers = new Set<string>();

  for (const source of descriptors) {
    if (source.kind === "builtin" || isLocalPath(source.path)) {
      const avatarLayerPath = resolveAvatarLayerSettingsPath(source.path, activeAvatar);
      if (!appliedAvatarLayers.has(avatarLayerPath)) {
        try {
          const avatarText = await loader.readText(avatarLayerPath);
          const avatarLayer = parseJsonText(avatarText);
          settings = deepMerge(settings, avatarLayer);
        } catch {
          // Avatar layer is optional for each source.
        }
        appliedAvatarLayers.add(avatarLayerPath);
      }
    }

    try {
      const text = await loader.readText(source.uri, { forSettings: true });
      const layer = parseJsonText(text);
      settings = deepMerge(settings, layer);
      if (!options.avatar && settings.avatar?.trim()) {
        activeAvatar = settings.avatar.trim();
      }
      settings.avatar = options.avatar?.trim() || activeAvatar;
      meta.sources.push({
        id: source.id,
        path: source.path,
        exists: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      meta.sources.push({
        id: source.id,
        path: source.path,
        exists: !classifyMissingResource(message),
        error: message,
      });
    }
  }

  settings.avatar = options.avatar?.trim() || activeAvatar;
  settings = normalizeSettingsPaths(settings, options.projectRoot, homeDir);
  settings = settingsSchema.parse(settings) as AgenterSettings;
  return {
    settings,
    meta,
  };
};
