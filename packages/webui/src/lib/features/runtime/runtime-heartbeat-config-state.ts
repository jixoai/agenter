import type { ScopedSettingsOutput } from "@agenter/client-sdk";
import type { SettingsLayerFile } from "$lib/features/settings/settings-graph-types";
import { YAMLMap, isMap, parseDocument } from "yaml";

export interface RuntimeHeartbeatConfigDraft {
	temperature: number | null;
	topK: number | null;
	maxToken: number | null;
	thinkingEnabled: boolean;
	thinkingBudgetTokens: number | null;
}

export interface RuntimeHeartbeatConfigBinding {
	editableLayerId: string | null;
	editableLayerSource: string | null;
	activeProviderId: string | null;
	providerLabel: string | null;
	draft: RuntimeHeartbeatConfigDraft;
}

const toRecord = (value: unknown): Record<string, unknown> | null => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
};

const toNumberOrNull = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

const defaultDraft = (): RuntimeHeartbeatConfigDraft => ({
	temperature: null,
	topK: null,
	maxToken: null,
	thinkingEnabled: false,
	thinkingBudgetTokens: null,
});

export const pickEditableSettingsLayerId = (graph: ScopedSettingsOutput | null): string | null =>
	graph?.layers.find((layer) => layer.editable)?.layerId ?? null;

export const readRuntimeHeartbeatConfigBinding = (
	graph: ScopedSettingsOutput | null,
	layerFile: SettingsLayerFile | null,
): RuntimeHeartbeatConfigBinding => {
	const effective = toRecord(graph?.effective.value);
	const ai = toRecord(effective?.ai);
	const providers = toRecord(ai?.providers);
	const activeProviderId =
		typeof ai?.activeProvider === 'string' && ai.activeProvider.length > 0
			? ai.activeProvider
			: Object.keys(providers ?? {})[0] ?? null;
	const provider = activeProviderId ? toRecord(providers?.[activeProviderId]) : null;
	const thinking = toRecord(provider?.thinking);
	const model = typeof provider?.model === 'string' && provider.model.length > 0 ? provider.model : null;
	return {
		editableLayerId: layerFile?.layer.layerId ?? pickEditableSettingsLayerId(graph),
		editableLayerSource: layerFile?.layer.sourceId ?? null,
		activeProviderId,
		providerLabel: activeProviderId ? [activeProviderId, model].filter(Boolean).join(' · ') : null,
		draft: {
			temperature: toNumberOrNull(provider?.temperature),
			topK: toNumberOrNull(provider?.topK),
			maxToken: toNumberOrNull(provider?.maxToken),
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
	if (value === null || value === '') {
		parent.delete(key);
		return;
	}
	parent.set(key, value);
};

export const writeRuntimeHeartbeatConfigLayer = (input: {
	content: string;
	activeProviderId: string;
	draft: RuntimeHeartbeatConfigDraft;
}): string => {
	const document = parseDocument(input.content.trim().length > 0 ? input.content : '{}');
	if (!isMap(document.contents)) {
		document.contents = new YAMLMap() as unknown as NonNullable<typeof document.contents>;
	}
	const root = document.contents as YAMLMap<unknown, unknown>;
	const ai = ensureMap(root, 'ai');
	const providers = ensureMap(ai, 'providers');
	const provider = ensureMap(providers, input.activeProviderId);

	ai.set('activeProvider', input.activeProviderId);
	setOrDelete(provider, 'temperature', input.draft.temperature);
	setOrDelete(provider, 'topK', input.draft.topK);
	setOrDelete(provider, 'maxToken', input.draft.maxToken);

	if (input.draft.thinkingEnabled || input.draft.thinkingBudgetTokens !== null) {
		const thinking = ensureMap(provider, 'thinking');
		thinking.set('enabled', input.draft.thinkingEnabled);
		setOrDelete(thinking, 'budgetTokens', input.draft.thinkingBudgetTokens);
	} else {
		provider.delete('thinking');
	}

	return String(document);
};

export const cloneRuntimeHeartbeatConfigDraft = (
	draft: RuntimeHeartbeatConfigDraft,
): RuntimeHeartbeatConfigDraft => ({
	temperature: draft.temperature,
	topK: draft.topK,
	maxToken: draft.maxToken,
	thinkingEnabled: draft.thinkingEnabled,
	thinkingBudgetTokens: draft.thinkingBudgetTokens,
});

export const createEmptyRuntimeHeartbeatConfigBinding = (): RuntimeHeartbeatConfigBinding => ({
	editableLayerId: null,
	editableLayerSource: null,
	activeProviderId: null,
	providerLabel: null,
	draft: defaultDraft(),
});
