import { getContext, setContext } from 'svelte';

const REASONING_CONTEXT_KEY = Symbol('reasoning-context');

export class ReasoningContext {
	isStreaming = $state(false);
	isOpen = $state(true);

	constructor(input: { isStreaming?: boolean; isOpen?: boolean } = {}) {
		this.isStreaming = input.isStreaming ?? false;
		this.isOpen = input.isOpen ?? true;
	}
}

export const setReasoningContext = (context: ReasoningContext): void => {
	setContext(REASONING_CONTEXT_KEY, context);
};

export const getReasoningContext = (): ReasoningContext => {
	const context = getContext<ReasoningContext | undefined>(REASONING_CONTEXT_KEY);
	if (!context) {
		throw new Error('Reasoning components must be used within Reasoning');
	}
	return context;
};
