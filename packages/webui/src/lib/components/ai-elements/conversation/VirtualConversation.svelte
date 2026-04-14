<script lang="ts" generics="Item">
	import { ScrollView, type ScrollViewVirtualizer, type ScrollVirtualConfig } from '@agenter/svelte-components';
	import type { Snippet } from 'svelte';

	import { cn } from '$lib/utils.js';

	import ConversationScrollButton from './ConversationScrollButton.svelte';
	import { setStickToBottomContext } from './stick-to-bottom-context.svelte.js';

	let {
		class: className = '',
		viewportClass = '',
		contentClass = '',
		viewportTestId = undefined,
		initial = 'auto',
		resize = 'smooth',
		items,
		virtual,
		virtualizerRef = $bindable<ScrollViewVirtualizer | null>(null),
		renderItem,
		renderEmpty,
		scrollButtonClass = '',
	}: {
		class?: string;
		viewportClass?: string;
		contentClass?: string;
		viewportTestId?: string;
		initial?: ScrollBehavior;
		resize?: ScrollBehavior;
		items: readonly Item[];
		virtual: Omit<ScrollVirtualConfig<Item>, 'items'>;
		virtualizerRef?: ScrollViewVirtualizer | null;
		renderItem?: Snippet<[Item, number]>;
		renderEmpty?: Snippet;
		scrollButtonClass?: string;
	} = $props();

	const virtualConfig = $derived({
		...virtual,
		items,
	} satisfies ScrollVirtualConfig<Item>);

	const context = setStickToBottomContext();

	let viewportRef = $state<HTMLDivElement | null>(null);
	let hasInitialStick = $state(false);

	$effect(() => {
		context.configure({ initial, resize });
		context.setElement(viewportRef);
		return () => {
			context.setElement(null);
		};
	});

	$effect(() => {
		const itemCount = items.length;
		const viewport = viewportRef;
		if (!viewport || itemCount === 0) {
			return;
		}
		const shouldStick = !hasInitialStick || context.isAtBottom;
		const behavior = hasInitialStick ? resize : initial;
		requestAnimationFrame(() => {
			if (shouldStick) {
				context.scrollToBottom(behavior);
			}
		});
		hasInitialStick = true;
	});
</script>

<div class={cn('relative flex h-full min-h-0 flex-col overflow-hidden', className)} role="log">
	<ScrollView
		class={cn('h-full', viewportClass)}
		{contentClass}
		{viewportTestId}
		bind:viewportRef
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

	<ConversationScrollButton
		aria-label="Scroll to latest"
		class={scrollButtonClass}
		title="Scroll to latest"
	/>
</div>
