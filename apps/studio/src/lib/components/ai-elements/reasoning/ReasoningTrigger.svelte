<script lang="ts">
	import Brain from '@lucide/svelte/icons/brain';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	import { cn } from '$lib/utils.js';

	import { getReasoningContext } from './reasoning-context.svelte.js';

	let { class: className = '', children, ...restProps }: { class?: string; children?: import('svelte').Snippet } =
		$props();

	const context = getReasoningContext();

	const label = $derived(context.isStreaming ? 'Thinking...' : 'Thought process');
</script>

<summary
	class={cn('text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm', className)}
	{...restProps}
>
	{#if children}
		{@render children?.()}
	{:else}
		<Brain class="size-4" />
		<span>{label}</span>
		<ChevronDown class={cn('size-4 transition-transform', context.isOpen ? 'rotate-180' : 'rotate-0')} />
	{/if}
</summary>
