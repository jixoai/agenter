<script lang="ts" generics="Item">
	import {
		AnchoredVirtualList,
		type AnchoredVirtualListScrollHandle,
		type ScrollController,
		type ScrollViewVirtualizer,
		type ScrollVirtualConfig,
	} from '@agenter/svelte-components';
	import type { Snippet } from 'svelte';

	import { cn } from '$lib/utils.js';

	import ConversationScrollButton from './ConversationScrollButton.svelte';

	let {
		class: className = '',
		viewportClass = '',
		contentClass = '',
		viewportTestId = undefined,
		initial = 'auto',
		resize = 'auto',
		viewportRef = $bindable<HTMLDivElement | null>(null),
		contentRef = $bindable<HTMLDivElement | null>(null),
		timelineRef = $bindable<AnchoredVirtualListScrollHandle | null>(null),
		scrollControllerRef = $bindable<ScrollController | null>(null),
		scrollButtonRef = $bindable<HTMLButtonElement | null>(null),
		items,
		virtual,
		virtualizerRef = $bindable<ScrollViewVirtualizer | null>(null),
		atTop = $bindable(false),
		renderItem,
		renderEmpty,
		renderBefore,
		renderAfter,
		scrollButtonClass = '',
	}: {
		class?: string;
		viewportClass?: string;
		contentClass?: string;
		viewportTestId?: string;
		initial?: ScrollBehavior;
		resize?: ScrollBehavior;
		viewportRef?: HTMLDivElement | null;
		contentRef?: HTMLDivElement | null;
		timelineRef?: AnchoredVirtualListScrollHandle | null;
		scrollControllerRef?: ScrollController | null;
		scrollButtonRef?: HTMLButtonElement | null;
		items: readonly Item[];
		virtual: Omit<ScrollVirtualConfig<Item>, 'items'>;
		virtualizerRef?: ScrollViewVirtualizer | null;
		atTop?: boolean;
		renderItem?: Snippet<[Item, number]>;
		renderEmpty?: Snippet;
		renderBefore?: Snippet;
		renderAfter?: Snippet;
		scrollButtonClass?: string;
	} = $props();

	const resolvedViewportClass = $derived(cn('conversation-scroll-viewport', viewportClass));
	let atLatest = $state(true);

	const virtualConfig = $derived.by((): Omit<ScrollVirtualConfig<Item>, 'items'> => virtual);
</script>

<div class={cn('relative flex h-full min-h-0 flex-col overflow-hidden', className)} role="log">
	<AnchoredVirtualList
		class="h-full"
		viewportClass={resolvedViewportClass}
		contentClass={contentClass}
		{viewportTestId}
		{items}
		bind:viewportRef
		bind:contentRef
		bind:virtualizerRef
		virtual={virtualConfig}
		bind:scrollHandleRef={timelineRef}
		bind:scrollControllerRef
		bind:atLatest
		bind:atStart={atTop}
	>
		{#snippet start()}
			{@render renderBefore?.()}
		{/snippet}

		{#snippet item(entry, index)}
			{@render renderItem?.(entry, index)}
		{/snippet}

		{#snippet empty()}
			{@render renderEmpty?.()}
		{/snippet}

		{#snippet end()}
			{@render renderAfter?.()}
		{/snippet}
	</AnchoredVirtualList>

	<ConversationScrollButton
		bind:buttonRef={scrollButtonRef}
		aria-label="Scroll to latest"
		class={scrollButtonClass}
		data-scroll-aware="true"
		title="Scroll to latest"
		visible={!atLatest}
	/>
</div>
