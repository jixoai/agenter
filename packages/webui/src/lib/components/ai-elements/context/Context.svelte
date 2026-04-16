<script lang="ts">
	import { DropdownMenu } from '$lib/components/ui/dropdown-menu/index.js';

	import {
		createAiElementsContextState,
		setAiElementsContextState,
		type AiElementsContextUsage,
	} from './context-state.svelte.js';

	let {
		maxTokens = null,
		modelId = null,
		usage = null,
		usedTokens = null,
		estimatedCostLabel = null,
		disabled = false,
		open = $bindable(false),
		children,
	}: {
		maxTokens?: number | null;
		modelId?: string | null;
		usage?: AiElementsContextUsage | null;
		usedTokens?: number | null;
		estimatedCostLabel?: string | null;
		disabled?: boolean;
		open?: boolean;
		children?: import('svelte').Snippet;
	} = $props();

	const state = $state(createAiElementsContextState());
	setAiElementsContextState(state);

	$effect(() => {
		state.maxTokens = maxTokens;
		state.modelId = modelId;
		state.usage = usage;
		state.usedTokens = usedTokens;
		state.estimatedCostLabel = estimatedCostLabel;
		state.disabled = disabled;
		state.open = open;
	});

	$effect(() => {
		open = state.open;
	});
</script>

<DropdownMenu bind:open={state.open}>
	{@render children?.()}
</DropdownMenu>
