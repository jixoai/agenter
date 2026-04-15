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
	resize = 'auto',
	viewportRef = $bindable<HTMLDivElement | null>(null),
		items,
		virtual,
		virtualizerRef = $bindable<ScrollViewVirtualizer | null>(null),
		atTop = $bindable(false),
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
		viewportRef?: HTMLDivElement | null;
		items: readonly Item[];
		virtual: Omit<ScrollVirtualConfig<Item>, 'items'>;
		virtualizerRef?: ScrollViewVirtualizer | null;
		atTop?: boolean;
		renderItem?: Snippet<[Item, number]>;
		renderEmpty?: Snippet;
		scrollButtonClass?: string;
	} = $props();

	const resolvedViewportClass = $derived(cn('conversation-scroll-viewport', viewportClass));

	const virtualConfig = $derived({
		...virtual,
		items,
	} satisfies ScrollVirtualConfig<Item>);

	const context = setStickToBottomContext({
		observeMutations: false,
		observeResize: false,
	});
	const TOP_THRESHOLD = 48;
	let hasInitialStick = false;
	let pendingStickFrame = 0;

	const syncTopState = (): void => {
		atTop = (viewportRef?.scrollTop ?? Number.POSITIVE_INFINITY) <= TOP_THRESHOLD;
	};

	$effect(() => {
		context.configure({ initial, resize });
		context.setElement(viewportRef);
		syncTopState();
		return () => {
			context.setElement(null);
		};
	});

	$effect(() => {
		const viewport = viewportRef;
		if (!viewport) {
			atTop = false;
			return;
		}
		syncTopState();
		const onScroll = (): void => {
			syncTopState();
		};
		viewport.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			viewport.removeEventListener('scroll', onScroll);
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
		if (pendingStickFrame !== 0) {
			cancelAnimationFrame(pendingStickFrame);
		}
		pendingStickFrame = requestAnimationFrame(() => {
			pendingStickFrame = 0;
			if (shouldStick) {
				context.scrollToBottom(behavior);
			}
		});
		hasInitialStick = true;
		return () => {
			if (pendingStickFrame !== 0) {
				cancelAnimationFrame(pendingStickFrame);
				pendingStickFrame = 0;
			}
		};
	});
</script>

<div class={cn('relative flex h-full min-h-0 flex-col overflow-hidden', className)} role="log">
	<ScrollView
		class="h-full"
		viewportClass={resolvedViewportClass}
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
		data-scroll-aware="true"
		title="Scroll to latest"
	/>
</div>

<style>
	:global(.conversation-scroll-viewport) {
		scroll-timeline-name: --conversation-scroll;
		scroll-timeline-axis: block;
	}
</style>
