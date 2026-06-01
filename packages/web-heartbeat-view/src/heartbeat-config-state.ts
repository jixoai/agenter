import { YAMLMap, isMap, parseDocument } from "yaml";

import type {
  HeartbeatConfigBinding,
  HeartbeatConfigDraft,
  HeartbeatConfigLayerFile,
  HeartbeatProviderPricingBand,
  ScopedSettingsOutput,
} from "./types";

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const parseHeartbeatDraftNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const readPricingBands = (value: unknown): HeartbeatProviderPricingBand[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const record = toRecord(entry);
    if (!record) {
      return [];
    }
    const inputPerMillion = toNumberOrNull(record.inputPerMillion);
    const outputPerMillion = toNumberOrNull(record.outputPerMillion);
    if (inputPerMillion === null || outputPerMillion === null) {
      return [];
    }
    return [
      {
        upToTokens: toNumberOrNull(record.upToTokens),
        inputPerMillion,
        cachedInputPerMillion: toNumberOrNull(record.cachedInputPerMillion),
        outputPerMillion,
      },
    ];
  });
};

export const defaultHeartbeatConfigDraft = (): HeartbeatConfigDraft => ({
  temperature: null,
  topK: null,
  maxToken: null,
  thinkingEnabled: false,
  thinkingBudgetTokens: null,
});

const pickEditableSettingsLayer = (graph: ScopedSettingsOutput | null) => {
  if (!graph) {
    return null;
  }
  return (
    graph.layers.find((layer) => layer.editable && layer.sourceId === "user:avatar") ??
    graph.layers.find((layer) => layer.editable && layer.kind === "avatar") ??
    graph.layers.find((layer) => layer.editable && layer.sourceId === "user") ??
    graph.layers.find((layer) => layer.editable) ??
    null
  );
};

export const readHeartbeatConfigBinding = (
  graph: ScopedSettingsOutput | null,
  layerFile: HeartbeatConfigLayerFile | null,
): HeartbeatConfigBinding => {
  const effective = toRecord(graph?.effective.value);
  const ai = toRecord(effective?.ai);
  const providers = toRecord(ai?.providers);
  const activeProviderId =
    typeof ai?.activeProvider === "string" && ai.activeProvider.length > 0
      ? ai.activeProvider
      : (Object.keys(providers ?? {})[0] ?? null);
  const provider = activeProviderId ? toRecord(providers?.[activeProviderId]) : null;
  const thinking = toRecord(ai?.thinking);
  const model = typeof provider?.model === "string" && provider.model.length > 0 ? provider.model : null;
  const pricing = toRecord(provider?.pricing);
  const pricingCurrency =
    typeof pricing?.currency === "string" && pricing.currency.trim().length > 0 ? pricing.currency : null;
  const pricingBands = readPricingBands(pricing?.bands);
  const editableLayer = layerFile?.layer ?? pickEditableSettingsLayer(graph);
  return {
    editableLayerId: editableLayer?.layerId ?? null,
    editableLayerSource: editableLayer?.sourceId ?? null,
    activeProviderId,
    providerLabel: activeProviderId ? [activeProviderId, model].filter(Boolean).join(" · ") : null,
    providerMetadata: activeProviderId
      ? {
          providerId: activeProviderId,
          model,
          maxContextTokens: toNumberOrNull(provider?.maxContextTokens),
          pricingCurrency,
          pricingBands,
        }
      : null,
    draft: {
      temperature: toNumberOrNull(ai?.temperature),
      topK: toNumberOrNull(ai?.topK),
      maxToken: toNumberOrNull(ai?.maxToken),
      thinkingEnabled: thinking?.enabled === true,
      thinkingBudgetTokens: toNumberOrNull(thinking?.budgetTokens),
    },
  };
};

const ensureMap = (parent: YAMLMap<unknown, unknown>, key: string): YAMLMap<unknown, unknown> => {
  const existing = parent.get(key, true);
  if (isMap(existing)) {
    return existing as YAMLMap<unknown, unknown>;
  }
  const next = new YAMLMap();
  parent.set(key, next);
  return next;
};

const setOrDelete = (parent: YAMLMap<unknown, unknown>, key: string, value: number | string | null): void => {
  if (value === null || value === "") {
    parent.delete(key);
    return;
  }
  parent.set(key, value);
};

const isJsonBackedSettingsLayer = (path: string | null | undefined, content: string): boolean => {
  if (typeof path === "string" && path.toLowerCase().endsWith(".json")) {
    return true;
  }
  const trimmed = content.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.length === 0;
};

const ensureJsonRoot = (content: string): Record<string, unknown> => {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  return toRecord(parsed) ?? {};
};

const ensureJsonObject = (parent: Record<string, unknown>, key: string): Record<string, unknown> => {
  const existing = toRecord(parent[key]);
  if (existing) {
    return existing;
  }
  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
};

const setOrDeleteJson = (parent: Record<string, unknown>, key: string, value: number | string | null): void => {
  if (value === null || value === "") {
    delete parent[key];
    return;
  }
  parent[key] = value;
};

export const writeHeartbeatConfigLayer = (input: {
  path?: string | null;
  content: string;
  draft: HeartbeatConfigDraft;
}): string => {
  if (isJsonBackedSettingsLayer(input.path, input.content)) {
    const root = ensureJsonRoot(input.content);
    const ai = ensureJsonObject(root, "ai");

    setOrDeleteJson(ai, "temperature", input.draft.temperature);
    setOrDeleteJson(ai, "topK", input.draft.topK);
    setOrDeleteJson(ai, "maxToken", input.draft.maxToken);

    if (input.draft.thinkingEnabled || input.draft.thinkingBudgetTokens !== null) {
      const thinking = ensureJsonObject(ai, "thinking");
      thinking.enabled = input.draft.thinkingEnabled;
      setOrDeleteJson(thinking, "budgetTokens", input.draft.thinkingBudgetTokens);
    } else {
      delete ai.thinking;
    }

    return `${JSON.stringify(root, null, 2)}\n`;
  }

  const document = parseDocument(input.content.trim().length > 0 ? input.content : "{}");
  if (!isMap(document.contents)) {
    document.contents = new YAMLMap() as unknown as NonNullable<typeof document.contents>;
  }
  const root = document.contents as YAMLMap<unknown, unknown>;
  const ai = ensureMap(root, "ai");

  setOrDelete(ai, "temperature", input.draft.temperature);
  setOrDelete(ai, "topK", input.draft.topK);
  setOrDelete(ai, "maxToken", input.draft.maxToken);

  if (input.draft.thinkingEnabled || input.draft.thinkingBudgetTokens !== null) {
    const thinking = ensureMap(ai, "thinking");
    thinking.set("enabled", input.draft.thinkingEnabled);
    setOrDelete(thinking, "budgetTokens", input.draft.thinkingBudgetTokens);
  } else {
    ai.delete("thinking");
  }

  return String(document);
};

export const cloneHeartbeatConfigDraft = (draft: HeartbeatConfigDraft): HeartbeatConfigDraft => ({
  temperature: draft.temperature,
  topK: draft.topK,
  maxToken: draft.maxToken,
  thinkingEnabled: draft.thinkingEnabled,
  thinkingBudgetTokens: draft.thinkingBudgetTokens,
});
