<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';

	import { formatContextInteger } from './context-format';
	import { getAiElementsContextState } from './context-state.svelte.js';

	const state = getAiElementsContextState();
</script>

<header class="grid gap-1.5">
	<div class="flex min-w-0 items-center justify-between gap-2">
		<Badge variant="outline" class="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
			Context
		</Badge>
		{#if state.usedTokens !== null}
			<div class="truncate text-[11px] text-muted-foreground">{formatContextInteger(state.usedTokens)} used</div>
		{/if}
	</div>
	<div class="flex min-w-0 flex-wrap items-center gap-2">
		<div class="truncate text-sm font-medium">{state.modelId ?? 'Latest model call'}</div>
		{#if state.maxTokens !== null}
			<div class="truncate text-[11px] text-muted-foreground">Max {formatContextInteger(state.maxTokens)}</div>
		{/if}
	</div>
</header>
