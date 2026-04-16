<script lang="ts">
	import { formatContextInteger, formatContextPercent } from './context-format';
	import { getAiElementsContextState } from './context-state.svelte.js';

	const state = getAiElementsContextState();
	const progress = $derived.by(() => {
		if (state.usedTokens === null || state.maxTokens === null || state.maxTokens <= 0) {
			return null;
		}
		return Math.min(1, state.usedTokens / state.maxTokens);
	});
	const remaining = $derived.by(() => {
		if (state.usedTokens === null || state.maxTokens === null) {
			return null;
		}
		return Math.max(0, state.maxTokens - state.usedTokens);
	});
</script>

<footer class="grid gap-2 border-t border-border/50 pt-3">
	{#if progress !== null}
		<div class="grid gap-1">
			<div class="h-1.5 overflow-hidden rounded-full bg-muted/75">
				<div class="h-full rounded-full bg-primary/75" style:width={`${Math.max(0.02, progress) * 100}%`}></div>
			</div>
			<div class="flex min-w-0 flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
				<div>{formatContextPercent(progress)} used</div>
				<div>{formatContextInteger(remaining)} remaining</div>
			</div>
		</div>
	{/if}
	{#if state.estimatedCostLabel}
		<div class="text-[11px] text-muted-foreground">Estimated cost {state.estimatedCostLabel}</div>
	{/if}
</footer>
