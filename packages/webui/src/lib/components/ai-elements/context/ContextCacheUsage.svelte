<script lang="ts">
	import ContextUsageRow from './ContextUsageRow.svelte';
	import { getAiElementsContextState } from './context-state.svelte.js';

	const state = getAiElementsContextState();
</script>

{#if typeof state.usage?.cachedInputTokens === 'number'}
	<ContextUsageRow label="Cache" description="Cached input tokens" value={state.usage.cachedInputTokens} />
{/if}
