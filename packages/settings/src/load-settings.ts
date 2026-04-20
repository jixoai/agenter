import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { defaultAvatarNickname } from "@agenter/avatar";
import { toJSONSchema } from "zod";

import {
  collectChangedPointers,
  collectNodePointers,
  createLayerId,
  recordLayerProvenance,
  toProvenanceObject,
} from "./cascade-graph";
import { deepMerge } from "./merge";
import { ResourceLoader } from "./resource-loader";
import { DEFAULT_LOOP_RETRY_POLICY } from "./runtime-policy";
import { settingsSchema } from "./schema";
import { settingsSource } from "./source";
import type {
  AgenterSettings,
  BuiltinSettingsSource,
  LoadSettingsOptions,
  LoadedSettings,
  SettingsGraphLayer,
  SettingsProvenanceEntry,
  SettingsSourceInput,
} from "./types";

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
    retryPolicy: { ...DEFAULT_LOOP_RETRY_POLICY },
  },
  ai: {
    activeProvider: "default",
    temperature: 0.2,
    maxToken: 64_000,
    providers: {
      default: {
        apiStandard: "openai-chat",
        vendor: "deepseek",
        model: "deepseek-chat",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        baseUrl: "https://api.deepseek.com/v1",
        maxRetries: 2,
      },
    },
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

const readAvatarNameFromRawSettings = (text: string): string | undefined => {
  try {
    const parsed = JSON.parse(text) as { avatar?: unknown };
    return typeof parsed.avatar === "string" && parsed.avatar.trim().length > 0 ? parsed.avatar.trim() : undefined;
  } catch {
    return undefined;
  }
};

const resolveAvatarSettingsPath = (settingsPath: string, avatar: string): string | null => {
  if (!isLocalPath(settingsPath)) {
    return null;
  }
  if (settingsPath.endsWith("/settings.local.json")) {
    return join(dirname(settingsPath), "avatar", avatar, "settings.local.json");
  }
  if (settingsPath.endsWith("/settings.json")) {
    return join(dirname(settingsPath), "avatar", avatar, "settings.json");
  }
  return null;
};

const resolveAvatarForSourceLayer = (input: {
  avatarOverride?: string;
  sourceText?: string;
  settings: AgenterSettings;
}): string => {
  return (
    input.avatarOverride?.trim() ??
    (input.sourceText ? readAvatarNameFromRawSettings(input.sourceText) : undefined) ??
    input.settings.avatar?.trim() ??
    defaultAvatarNickname()
  );
};

const readActiveProvider = (settings: AgenterSettings | undefined): string | undefined => {
  const value = settings?.ai?.activeProvider?.trim();
  return value && value.length > 0 ? value : undefined;
};

const resolveAiSelection = (
  settings: AgenterSettings,
  layers: Partial<Record<BuiltinSettingsSource, AgenterSettings>>,
): AgenterSettings => {
  if (!settings.ai) {
    return settings;
  }

  const activeProvider =
    readActiveProvider(layers.local) ??
    readActiveProvider(layers.user) ??
    readActiveProvider(layers.project) ??
    readActiveProvider(settings);

  if (!activeProvider || activeProvider === settings.ai.activeProvider) {
    return settings;
  }

  return {
    ...settings,
    ai: {
      ...settings.ai,
      activeProvider,
    },
  };
};

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
  const graphLayers: SettingsGraphLayer[] = [];
  const provenance = new Map<string, SettingsProvenanceEntry>();
  let graphLayerIndex = 0;

  const pushLayer = (input: Omit<SettingsGraphLayer, "layerId">): SettingsGraphLayer => {
    const layer: SettingsGraphLayer = {
      ...input,
      layerId: createLayerId(input.kind, input.sourceId, graphLayerIndex),
    };
    graphLayerIndex += 1;
    graphLayers.push(layer);
    return layer;
  };

  const applyMergedLayer = (patch: AgenterSettings, layer: SettingsGraphLayer, note?: string): void => {
    const before = settings;
    settings = deepMerge(settings, patch);
    const pointers = collectChangedPointers(before, settings);
    if (pointers.length === 0) {
      return;
    }
    recordLayerProvenance({
      provenance,
      pointers,
      after: settings,
      layer,
      note,
    });
  };

  const applyDirectMutation = (next: AgenterSettings, layer: SettingsGraphLayer, note?: string): void => {
    const before = settings;
    settings = next;
    const pointers = collectChangedPointers(before, settings);
    if (pointers.length === 0) {
      return;
    }
    recordLayerProvenance({
      provenance,
      pointers,
      after: settings,
      layer,
      note,
    });
  };

  const applyDerivedTransform = (input: {
    sourceId: string;
    path: string;
    note: string;
    transform: (value: AgenterSettings) => AgenterSettings;
  }): void => {
    const before = settings;
    const after = input.transform(settings);
    const pointers = collectChangedPointers(before, after);
    settings = after;
    if (pointers.length === 0) {
      return;
    }
    const layer = pushLayer({
      sourceId: input.sourceId,
      kind: "derived",
      path: input.path,
      exists: true,
      note: input.note,
    });
    recordLayerProvenance({
      provenance,
      pointers,
      after: settings,
      layer,
      note: input.note,
    });
  };

  const defaultLayer = pushLayer({
    sourceId: "default",
    kind: "default",
    path: "builtin:default",
    exists: true,
    note: "default settings",
  });
  recordLayerProvenance({
    provenance,
    pointers: collectNodePointers(settings),
    after: settings,
    layer: defaultLayer,
    note: defaultLayer.note,
  });

  const avatarOverride = options.avatar?.trim();
  const avatarOverrideLayer = avatarOverride
    ? pushLayer({
        sourceId: "input-avatar",
        kind: "derived",
        path: "derived:input-avatar-override",
        exists: true,
        note: "loadSettings avatar override",
      })
    : null;

  if (options.avatar?.trim()) {
    applyDirectMutation(
      {
        ...settings,
        avatar: options.avatar.trim(),
      },
      avatarOverrideLayer ?? defaultLayer,
      "apply avatar override from loadSettings input",
    );
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
  const parsedBuiltinLayers: Partial<Record<BuiltinSettingsSource, AgenterSettings>> = {};

  for (const source of descriptors) {
    try {
      const text = await loader.readText(source.uri, { forSettings: true });
      const avatarPath = resolveAvatarSettingsPath(
        source.path,
        resolveAvatarForSourceLayer({
          avatarOverride,
          sourceText: text,
          settings,
        }),
      );
      if (avatarPath) {
        try {
          const avatarText = await loader.readText(avatarPath, { forSettings: true });
          const avatarLayer = parseJsonText(avatarText);
          const avatarGraphLayer = pushLayer({
            sourceId: `${source.id}:avatar`,
            kind: "avatar",
            path: avatarPath,
            exists: true,
          });
          applyMergedLayer(avatarLayer, avatarGraphLayer, `avatar settings layer ${source.id}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const exists = !classifyMissingResource(message);
          pushLayer({
            sourceId: `${source.id}:avatar`,
            kind: "avatar",
            path: avatarPath,
            exists,
            note: message,
          });
        }
      }
      const layer = parseJsonText(text);
      const graphLayer = pushLayer({
        sourceId: source.id,
        kind: "file",
        path: source.path,
        exists: true,
      });
      if (source.kind === "builtin" && source.builtin) {
        parsedBuiltinLayers[source.builtin] = layer;
      }
      applyMergedLayer(layer, graphLayer, `settings layer ${source.id}`);
      const nextAvatar = avatarOverride ?? settings.avatar?.trim() ?? defaultAvatarNickname();
      if (nextAvatar && settings.avatar !== nextAvatar) {
        applyDirectMutation(
          {
            ...settings,
            avatar: nextAvatar,
          },
          avatarOverrideLayer ?? graphLayer,
          "align active avatar after layer merge",
        );
      }
      meta.sources.push({
        id: source.id,
        path: source.path,
        exists: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exists = !classifyMissingResource(message);
      pushLayer({
        sourceId: source.id,
        kind: "file",
        path: source.path,
        exists,
        note: message,
      });
      meta.sources.push({
        id: source.id,
        path: source.path,
        exists,
        error: message,
      });
    }
  }

  const finalAvatar = avatarOverride ?? settings.avatar?.trim() ?? defaultAvatarNickname();
  if (finalAvatar && settings.avatar !== finalAvatar) {
    applyDirectMutation(
      {
        ...settings,
        avatar: finalAvatar,
      },
      avatarOverrideLayer ?? defaultLayer,
      "align final avatar",
    );
  }

  applyDerivedTransform({
    sourceId: "derived:ai-selection",
    path: "derived:resolve-ai-selection",
    note: "resolve active provider precedence",
    transform: (value) => resolveAiSelection(value, parsedBuiltinLayers),
  });

  applyDerivedTransform({
    sourceId: "derived:path-normalization",
    path: "derived:normalize-settings-paths",
    note: "normalize relative settings paths",
    transform: (value) => normalizeSettingsPaths(value, options.projectRoot, homeDir),
  });

  applyDerivedTransform({
    sourceId: "derived:schema-parse",
    path: "derived:schema-parse",
    note: "apply zod schema normalization",
    transform: (value) => settingsSchema.parse(value) as AgenterSettings,
  });

  const schema = toJSONSchema(settingsSchema, { unrepresentable: "any" }) as Record<string, unknown>;
  const effectiveContent = `${JSON.stringify(settings, null, 2)}\n`;

  return {
    settings,
    graph: {
      effective: {
        value: settings,
        content: effectiveContent,
      },
      layers: graphLayers,
      provenance: toProvenanceObject(provenance),
      schema,
    },
    meta,
  };
};
