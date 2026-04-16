<script lang="ts">
	import ContextUsageRow from './ContextUsageRow.svelte';
	import { getAiElementsContextState } from './context-state.svelte.js';

	const state = getAiElementsContextState();
</script>

{#if typeof state.usage?.outputTokens === 'number'}
	<ContextUsageRow label="Output" description="Completion tokens" value={state.usage.outputTokens} />
{/if}
