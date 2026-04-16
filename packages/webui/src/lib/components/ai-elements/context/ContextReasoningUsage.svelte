<script lang="ts">
	import ContextUsageRow from './ContextUsageRow.svelte';
	import { getAiElementsContextState } from './context-state.svelte.js';

	const state = getAiElementsContextState();
</script>

{#if typeof state.usage?.reasoningTokens === 'number'}
	<ContextUsageRow label="Reasoning" description="Thinking tokens" value={state.usage.reasoningTokens} />
{/if}
