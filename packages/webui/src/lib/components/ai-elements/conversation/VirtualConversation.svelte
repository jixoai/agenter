<script lang="ts" generics="Item">
	import { ScrollView, type ScrollViewVirtualizer, type ScrollVirtualConfig } from '@agenter/svelte-components';
	import type { Snippet } from 'svelte';

	import { cn } from '$lib/utils.js';

	let {
		class: className = '',
		viewportClass = '',
		contentClass = '',
		viewportTestId = undefined,
		items,
		virtual,
		virtualizerRef = $bindable<ScrollViewVirtualizer | null>(null),
		renderItem,
		renderEmpty,
	}: {
		class?: string;
		viewportClass?: string;
		contentClass?: string;
		viewportTestId?: string;
		items: readonly Item[];
		virtual: Omit<ScrollVirtualConfig<Item>, 'items'>;
		virtualizerRef?: ScrollViewVirtualizer | null;
		renderItem?: Snippet<[Item, number]>;
		renderEmpty?: Snippet;
	} = $props();

	const virtualConfig = $derived({
		...virtual,
		items,
	} satisfies ScrollVirtualConfig<Item>);
</script>

<div class={cn('relative flex h-full min-h-0 flex-col overflow-hidden', className)} role="log">
	<ScrollView
		class={cn('h-full', viewportClass)}
		{contentClass}
		{viewportTestId}
		bind:virtualizerRef
		virtual={virtualConfig}
	>
		{#snippet item(entry, index, _virtualItem)}
			{@render renderItem?.(entry, index)}
		{/snippet}

		{#snippet empty()}
			{@render renderEmpty?.()}
		{/snippet}
	</ScrollView>
</div>
