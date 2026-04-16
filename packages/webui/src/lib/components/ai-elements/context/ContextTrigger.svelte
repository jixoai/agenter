<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	import { Button } from '$lib/components/ui/button/index.js';
	import { DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu/index.js';

	import { formatContextInteger } from './context-format';
	import { getAiElementsContextState } from './context-state.svelte.js';

	let {
		class: className = '',
	}: {
		class?: string;
	} = $props();

	const state = getAiElementsContextState();
	const triggerLabel = $derived.by(() => {
		if (state.usedTokens === null) {
			return 'Context';
		}
		if (state.maxTokens !== null) {
			return `${formatContextInteger(state.usedTokens)} / ${formatContextInteger(state.maxTokens)}`;
		}
		return `${formatContextInteger(state.usedTokens)} used`;
	});
</script>

<DropdownMenuTrigger disabled={state.disabled}>
	{#snippet child({ props })}
		<Button
			{...props}
			variant="outline"
			size="sm"
			class={`min-w-0 rounded-full ${className}`.trim()}
			aria-label="Context"
			title="Context"
		>
			{#snippet children()}
				<span class="truncate">Context</span>
				<span class="truncate text-muted-foreground">{triggerLabel}</span>
				<ChevronDown class="size-3.5 opacity-70" />
			{/snippet}
		</Button>
	{/snippet}
</DropdownMenuTrigger>
