import {
  DEFAULT_LOOP_COMPACT_POLICY,
  DEFAULT_LOOP_RETRY_POLICY,
  type ResolvedLoopCompactPolicy,
  type ResolvedLoopRetryPolicy,
} from "@agenter/settings/runtime-policy";
import type { ScopedSettingsOutput } from "@agenter/client-sdk";
import { YAMLMap, isMap, parseDocument } from "yaml";

export interface RuntimeSettingsPolicyDraft {
  transportMaxRetries: number | null;
  compactThresholdEnabled: boolean;
  compactThresholdPromptFraction: number | null;
  compactOnAttentionRetry: boolean;
  compactOnContextOverflow: boolean;
  compactOnExternalContinuationLimit: boolean;
  compactOnTimeout: boolean;
  retryMaxAttempts: number | null;
  retryInitialBackoffMs: number | null;
  retryMultiplier: number | null;
  retryMaxBackoffMs: number | null;
  retryResetOnExternalInput: boolean;
  retryResetOnProgress: boolean;
  lang: string | null;
  promptRootDir: string | null;
  promptAgenterPath: string | null;
  promptAgenterSystemPath: string | null;
  promptSystemTemplatePath: string | null;
  promptResponseContractPath: string | null;
}

export interface RuntimeSettingsPolicyBinding {
  editableLayerId: string | null;
  editableLayerSource: string | null;
  activeProviderId: string | null;
  providerLabel: string | null;
  draft: RuntimeSettingsPolicyDraft;
}

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const toBooleanOr = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const readLegacyCompactThreshold = (value: unknown): number | null => {
  const parsed = toNumberOrNull(value);
  return parsed !== null && parsed > 0 && parsed <= 1 ? parsed : null;
};

export const parseRuntimeSettingsPolicyNumber = (value: unknown): number | null => {
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

export const parseRuntimeSettingsPolicyText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const defaultDraft = (): RuntimeSettingsPolicyDraft => ({
  transportMaxRetries: null,
  compactThresholdEnabled: DEFAULT_LOOP_COMPACT_POLICY.threshold.enabled,
  compactThresholdPromptFraction: DEFAULT_LOOP_COMPACT_POLICY.threshold.promptFraction,
  compactOnAttentionRetry: DEFAULT_LOOP_COMPACT_POLICY.recovery.attentionRetry,
  compactOnContextOverflow: DEFAULT_LOOP_COMPACT_POLICY.recovery.contextOverflow,
  compactOnExternalContinuationLimit: DEFAULT_LOOP_COMPACT_POLICY.recovery.externalContinuationLimit,
  compactOnTimeout: DEFAULT_LOOP_COMPACT_POLICY.recovery.timeout,
  retryMaxAttempts: DEFAULT_LOOP_RETRY_POLICY.maxAttempts,
  retryInitialBackoffMs: DEFAULT_LOOP_RETRY_POLICY.initialBackoffMs,
  retryMultiplier: DEFAULT_LOOP_RETRY_POLICY.multiplier,
  retryMaxBackoffMs: DEFAULT_LOOP_RETRY_POLICY.maxBackoffMs,
  retryResetOnExternalInput: DEFAULT_LOOP_RETRY_POLICY.resetOnExternalInput,
  retryResetOnProgress: DEFAULT_LOOP_RETRY_POLICY.resetOnProgress,
  lang: null,
  promptRootDir: null,
  promptAgenterPath: null,
  promptAgenterSystemPath: null,
  promptSystemTemplatePath: null,
  promptResponseContractPath: null,
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

const readEffectiveRetryPolicy = (value: unknown): ResolvedLoopRetryPolicy => {
  const record = toRecord(value);
  return {
    ...DEFAULT_LOOP_RETRY_POLICY,
    maxAttempts: toNumberOrNull(record?.maxAttempts),
    initialBackoffMs: toNumberOrNull(record?.initialBackoffMs) ?? DEFAULT_LOOP_RETRY_POLICY.initialBackoffMs,
    multiplier: toNumberOrNull(record?.multiplier) ?? DEFAULT_LOOP_RETRY_POLICY.multiplier,
    maxBackoffMs: toNumberOrNull(record?.maxBackoffMs) ?? DEFAULT_LOOP_RETRY_POLICY.maxBackoffMs,
    resetOnExternalInput: toBooleanOr(
      record?.resetOnExternalInput,
      DEFAULT_LOOP_RETRY_POLICY.resetOnExternalInput,
    ),
    resetOnProgress: toBooleanOr(record?.resetOnProgress, DEFAULT_LOOP_RETRY_POLICY.resetOnProgress),
  };
};

const readEffectiveCompactPolicy = (value: unknown): ResolvedLoopCompactPolicy => {
  const record = toRecord(value);
  const threshold = toRecord(record?.threshold);
  const recovery = toRecord(record?.recovery);
  return {
    threshold: {
      enabled: toBooleanOr(threshold?.enabled, DEFAULT_LOOP_COMPACT_POLICY.threshold.enabled),
      promptFraction:
        toNumberOrNull(threshold?.promptFraction) ?? DEFAULT_LOOP_COMPACT_POLICY.threshold.promptFraction,
    },
    recovery: {
      attentionRetry: toBooleanOr(
        recovery?.attentionRetry,
        DEFAULT_LOOP_COMPACT_POLICY.recovery.attentionRetry,
      ),
      contextOverflow: toBooleanOr(
        recovery?.contextOverflow,
        DEFAULT_LOOP_COMPACT_POLICY.recovery.contextOverflow,
      ),
      externalContinuationLimit: toBooleanOr(
        recovery?.externalContinuationLimit,
        DEFAULT_LOOP_COMPACT_POLICY.recovery.externalContinuationLimit,
      ),
      timeout: toBooleanOr(recovery?.timeout, DEFAULT_LOOP_COMPACT_POLICY.recovery.timeout),
    },
  };
};

export const readRuntimeSettingsPolicyBinding = (
  graph: ScopedSettingsOutput | null,
): RuntimeSettingsPolicyBinding => {
  if (!graph) {
    return {
      editableLayerId: null,
      editableLayerSource: null,
      activeProviderId: null,
      providerLabel: null,
      draft: defaultDraft(),
    };
  }

  const effective = toRecord(graph.effective.value);
  const ai = toRecord(effective?.ai);
  const providers = toRecord(ai?.providers);
  const activeProviderId =
    typeof ai?.activeProvider === "string" && ai.activeProvider.length > 0
      ? ai.activeProvider
      : (Object.keys(providers ?? {})[0] ?? null);
  const provider = activeProviderId ? toRecord(providers?.[activeProviderId]) : null;
  const loop = toRecord(effective?.loop);
  const prompt = toRecord(effective?.prompt);
  const retryPolicy = readEffectiveRetryPolicy(loop?.retryPolicy);
  const compactPolicy = readEffectiveCompactPolicy(loop?.compactPolicy);
  const legacyCompactThreshold = readLegacyCompactThreshold(provider?.compactThreshold);
  const effectiveCompactPolicy =
    loop?.compactPolicy === undefined && legacyCompactThreshold !== null
      ? {
          ...compactPolicy,
          threshold: {
            enabled: true,
            promptFraction: legacyCompactThreshold,
          },
        }
      : compactPolicy;
  const editableLayer = pickEditableSettingsLayer(graph);
  return {
    editableLayerId: editableLayer?.layerId ?? null,
    editableLayerSource: editableLayer?.sourceId ?? null,
    activeProviderId,
    providerLabel:
      activeProviderId && toStringOrNull(provider?.model)
        ? `${activeProviderId} · ${toStringOrNull(provider?.model)}`
        : activeProviderId,
    draft: {
      transportMaxRetries: toNumberOrNull(provider?.maxRetries),
      compactThresholdEnabled: effectiveCompactPolicy.threshold.enabled,
      compactThresholdPromptFraction: effectiveCompactPolicy.threshold.promptFraction,
      compactOnAttentionRetry: effectiveCompactPolicy.recovery.attentionRetry,
      compactOnContextOverflow: effectiveCompactPolicy.recovery.contextOverflow,
      compactOnExternalContinuationLimit: effectiveCompactPolicy.recovery.externalContinuationLimit,
      compactOnTimeout: effectiveCompactPolicy.recovery.timeout,
      retryMaxAttempts: retryPolicy.maxAttempts,
      retryInitialBackoffMs: retryPolicy.initialBackoffMs,
      retryMultiplier: retryPolicy.multiplier,
      retryMaxBackoffMs: retryPolicy.maxBackoffMs,
      retryResetOnExternalInput: retryPolicy.resetOnExternalInput,
      retryResetOnProgress: retryPolicy.resetOnProgress,
      lang: toStringOrNull(effective?.lang),
      promptRootDir: toStringOrNull(prompt?.rootDir),
      promptAgenterPath: toStringOrNull(prompt?.agenterPath),
      promptAgenterSystemPath: toStringOrNull(prompt?.internalSystemPath),
      promptSystemTemplatePath: toStringOrNull(prompt?.systemTemplatePath),
      promptResponseContractPath: toStringOrNull(prompt?.responseContractPath),
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

const setOrDelete = (
  parent: YAMLMap<unknown, unknown> | Record<string, unknown>,
  key: string,
  value: string | number | boolean | null,
): void => {
  if (parent instanceof YAMLMap) {
    if (value === null || value === "") {
      parent.delete(key);
      return;
    }
    parent.set(key, value);
    return;
  }
  if (value === null || value === "") {
    delete parent[key];
    return;
  }
  parent[key] = value;
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

export const writeRuntimeSettingsPolicyLayer = (input: {
  path?: string | null;
  content: string;
  activeProviderId: string;
  draft: RuntimeSettingsPolicyDraft;
}): string => {
  if (isJsonBackedSettingsLayer(input.path, input.content)) {
    const root = ensureJsonRoot(input.content);
    const ai = ensureJsonObject(root, "ai");
    const providers = ensureJsonObject(ai, "providers");
    const provider = ensureJsonObject(providers, input.activeProviderId);
    const loop = ensureJsonObject(root, "loop");
    const retryPolicy = ensureJsonObject(loop, "retryPolicy");
    const compactPolicy = ensureJsonObject(loop, "compactPolicy");
    const threshold = ensureJsonObject(compactPolicy, "threshold");
    const recovery = ensureJsonObject(compactPolicy, "recovery");
    const prompt = ensureJsonObject(root, "prompt");

    setOrDelete(provider, "maxRetries", input.draft.transportMaxRetries);
    setOrDelete(provider, "compactThreshold", null);

    setOrDelete(retryPolicy, "maxAttempts", input.draft.retryMaxAttempts);
    setOrDelete(retryPolicy, "initialBackoffMs", input.draft.retryInitialBackoffMs);
    setOrDelete(retryPolicy, "multiplier", input.draft.retryMultiplier);
    setOrDelete(retryPolicy, "maxBackoffMs", input.draft.retryMaxBackoffMs);
    setOrDelete(retryPolicy, "resetOnExternalInput", input.draft.retryResetOnExternalInput);
    setOrDelete(retryPolicy, "resetOnProgress", input.draft.retryResetOnProgress);

    setOrDelete(threshold, "enabled", input.draft.compactThresholdEnabled);
    setOrDelete(threshold, "promptFraction", input.draft.compactThresholdPromptFraction);
    setOrDelete(recovery, "attentionRetry", input.draft.compactOnAttentionRetry);
    setOrDelete(recovery, "contextOverflow", input.draft.compactOnContextOverflow);
    setOrDelete(
      recovery,
      "externalContinuationLimit",
      input.draft.compactOnExternalContinuationLimit,
    );
    setOrDelete(recovery, "timeout", input.draft.compactOnTimeout);

    setOrDelete(root, "lang", input.draft.lang);
    setOrDelete(prompt, "rootDir", input.draft.promptRootDir);
    setOrDelete(prompt, "agenterPath", input.draft.promptAgenterPath);
    setOrDelete(prompt, "internalSystemPath", input.draft.promptAgenterSystemPath);
    setOrDelete(prompt, "systemTemplatePath", input.draft.promptSystemTemplatePath);
    setOrDelete(prompt, "responseContractPath", input.draft.promptResponseContractPath);

    return `${JSON.stringify(root, null, 2)}\n`;
  }

  const document = parseDocument(input.content.trim().length > 0 ? input.content : "{}");
  if (!isMap(document.contents)) {
    document.contents = new YAMLMap() as unknown as NonNullable<typeof document.contents>;
  }
  const root = document.contents as YAMLMap<unknown, unknown>;
  const ai = ensureMap(root, "ai");
  const providers = ensureMap(ai, "providers");
  const provider = ensureMap(providers, input.activeProviderId);
  const loop = ensureMap(root, "loop");
  const retryPolicy = ensureMap(loop, "retryPolicy");
  const compactPolicy = ensureMap(loop, "compactPolicy");
  const threshold = ensureMap(compactPolicy, "threshold");
  const recovery = ensureMap(compactPolicy, "recovery");
  const prompt = ensureMap(root, "prompt");

  setOrDelete(provider, "maxRetries", input.draft.transportMaxRetries);
  setOrDelete(provider, "compactThreshold", null);

  setOrDelete(retryPolicy, "maxAttempts", input.draft.retryMaxAttempts);
  setOrDelete(retryPolicy, "initialBackoffMs", input.draft.retryInitialBackoffMs);
  setOrDelete(retryPolicy, "multiplier", input.draft.retryMultiplier);
  setOrDelete(retryPolicy, "maxBackoffMs", input.draft.retryMaxBackoffMs);
  setOrDelete(retryPolicy, "resetOnExternalInput", input.draft.retryResetOnExternalInput);
  setOrDelete(retryPolicy, "resetOnProgress", input.draft.retryResetOnProgress);

  setOrDelete(threshold, "enabled", input.draft.compactThresholdEnabled);
  setOrDelete(threshold, "promptFraction", input.draft.compactThresholdPromptFraction);
  setOrDelete(recovery, "attentionRetry", input.draft.compactOnAttentionRetry);
  setOrDelete(recovery, "contextOverflow", input.draft.compactOnContextOverflow);
  setOrDelete(recovery, "externalContinuationLimit", input.draft.compactOnExternalContinuationLimit);
  setOrDelete(recovery, "timeout", input.draft.compactOnTimeout);

  setOrDelete(root, "lang", input.draft.lang);
  setOrDelete(prompt, "rootDir", input.draft.promptRootDir);
  setOrDelete(prompt, "agenterPath", input.draft.promptAgenterPath);
  setOrDelete(prompt, "internalSystemPath", input.draft.promptAgenterSystemPath);
  setOrDelete(prompt, "systemTemplatePath", input.draft.promptSystemTemplatePath);
  setOrDelete(prompt, "responseContractPath", input.draft.promptResponseContractPath);

  return String(document);
};
