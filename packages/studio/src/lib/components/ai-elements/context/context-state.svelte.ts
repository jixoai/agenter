import { getContext, setContext } from 'svelte';

export interface AiElementsContextUsage {
	inputTokens: number;
	outputTokens: number;
	cachedInputTokens: number | null;
	reasoningTokens: number | null;
}

export interface AiElementsContextState {
	maxTokens: number | null;
	modelId: string | null;
	usage: AiElementsContextUsage | null;
	usedTokens: number | null;
	estimatedCostLabel: string | null;
	open: boolean;
	disabled: boolean;
}

const AI_ELEMENTS_CONTEXT_STATE = Symbol('ai-elements-context-state');

export const createAiElementsContextState = (): AiElementsContextState => ({
	maxTokens: null,
	modelId: null,
	usage: null,
	usedTokens: null,
	estimatedCostLabel: null,
	open: false,
	disabled: false,
});

export const setAiElementsContextState = (state: AiElementsContextState): void => {
	setContext(AI_ELEMENTS_CONTEXT_STATE, state);
};

export const getAiElementsContextState = (): AiElementsContextState =>
	getContext<AiElementsContextState>(AI_ELEMENTS_CONTEXT_STATE);
