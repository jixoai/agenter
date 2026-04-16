<script lang="ts">
	import ContextUsageRow from './ContextUsageRow.svelte';
	import { getAiElementsContextState } from './context-state.svelte.js';

	const state = getAiElementsContextState();
</script>

{#if typeof state.usage?.inputTokens === 'number'}
	<ContextUsageRow label="Input" description="Prompt tokens" value={state.usage.inputTokens} />
{/if}
