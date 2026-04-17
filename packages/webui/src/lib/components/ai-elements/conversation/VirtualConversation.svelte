<script lang="ts" generics="Item">
	import {
		ScrollView,
		type ScrollViewVirtualizer,
		type ScrollVirtualConfig,
	} from '@agenter/svelte-components';
	import type { Snippet } from 'svelte';
	import { tick, untrack } from 'svelte';

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
		contentRef = $bindable<HTMLDivElement | null>(null),
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

	const context = setStickToBottomContext({
		observeMutations: false,
		observeResize: false,
	});
	const virtualConfig = $derived.by(() => {
		const shouldForceBottomAnchor = context.shouldStick;
		const upstreamSizeAdjustHandler = virtual.shouldAdjustScrollPositionOnItemSizeChange;
		const nextSizeAdjustHandler =
			shouldForceBottomAnchor || upstreamSizeAdjustHandler
				? (item: Parameters<NonNullable<typeof upstreamSizeAdjustHandler>>[0],
						delta: Parameters<NonNullable<typeof upstreamSizeAdjustHandler>>[1],
						instance: Parameters<NonNullable<typeof upstreamSizeAdjustHandler>>[2]) => {
						if (shouldForceBottomAnchor) {
							return true;
						}
						return upstreamSizeAdjustHandler?.(item, delta, instance) ?? false;
					}
				: undefined;
		return {
			...virtual,
			items,
			initialOffset: virtual.initialOffset ?? Number.MAX_SAFE_INTEGER,
			shouldAdjustScrollPositionOnItemSizeChange: nextSizeAdjustHandler,
		} satisfies ScrollVirtualConfig<Item>;
	});
	const TOP_THRESHOLD = 48;
	const STICK_SETTLE_FRAME_LIMIT = 24;
	let hasInitialStick = false;
	let pendingStickFrame = 0;
	let pendingStickFrameFollowUp = 0;
	let pendingStickSettleFrame = 0;
	let pendingStickSettleFramesRemaining = 0;
	let pendingStickLockFrame = 0;
	let pendingStickLockFramesRemaining = 0;

	const scrollToLatest = (
		behavior: ScrollBehavior,
		virtualizer: ScrollViewVirtualizer | null = virtualizerRef,
	): void => {
		if (items.length === 0) {
			return;
		}
		if (viewportRef) {
			context.scrollToBottom(behavior);
			return;
		}
		if (virtualizer) {
			virtualizer.scrollToIndex(items.length - 1, { align: 'end', behavior });
			return;
		}
		context.scrollToBottom(behavior);
	};

	const syncTopState = (): void => {
		atTop = (viewportRef?.scrollTop ?? Number.POSITIVE_INFINITY) <= TOP_THRESHOLD;
	};

	const cancelPendingStickSettle = (): void => {
		if (pendingStickSettleFrame !== 0) {
			cancelAnimationFrame(pendingStickSettleFrame);
			pendingStickSettleFrame = 0;
		}
		pendingStickSettleFramesRemaining = 0;
	};

	const cancelPendingStickLock = (): void => {
		if (pendingStickLockFrame !== 0) {
			cancelAnimationFrame(pendingStickLockFrame);
			pendingStickLockFrame = 0;
		}
		pendingStickLockFramesRemaining = 0;
	};

	const armStickLock = (frames = STICK_SETTLE_FRAME_LIMIT + 4): void => {
		cancelPendingStickLock();
		pendingStickLockFramesRemaining = frames;
		const tickLock = (): void => {
			if (pendingStickLockFramesRemaining <= 0) {
				pendingStickLockFrame = 0;
				return;
			}
			pendingStickLockFramesRemaining -= 1;
			pendingStickLockFrame = requestAnimationFrame(tickLock);
		};
		pendingStickLockFrame = requestAnimationFrame(tickLock);
	};

	const shouldMaintainStick = (): boolean => context.shouldStick || pendingStickLockFramesRemaining > 0;

	const settleScrollToLatest = (
		behavior: ScrollBehavior,
		virtualizer: ScrollViewVirtualizer | null = virtualizerRef,
	): void => {
		cancelPendingStickSettle();
		armStickLock();
		pendingStickSettleFramesRemaining = STICK_SETTLE_FRAME_LIMIT;
		const run = (): void => {
			pendingStickSettleFrame = 0;
			if (!shouldMaintainStick()) {
				pendingStickSettleFramesRemaining = 0;
				return;
			}
			scrollToLatest(behavior, virtualizer);
			pendingStickSettleFramesRemaining -= 1;
			if (pendingStickSettleFramesRemaining <= 0) {
				return;
			}
			pendingStickSettleFrame = requestAnimationFrame(run);
		};
		pendingStickSettleFrame = requestAnimationFrame(run);
	};

	const handleVirtualSizeChange = (): void => {
		if (!hasInitialStick || !shouldMaintainStick()) {
			return;
		}
		settleScrollToLatest('auto');
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
		const virtualizer = virtualizerRef;
		if (!viewport || itemCount === 0) {
			return;
		}
		const shouldStick = !hasInitialStick || untrack(() => context.shouldStick);
		const behavior = hasInitialStick ? resize : initial;
		if (pendingStickFrame !== 0) {
			cancelAnimationFrame(pendingStickFrame);
		}
		if (pendingStickFrameFollowUp !== 0) {
			cancelAnimationFrame(pendingStickFrameFollowUp);
		}
		void tick().then(() => {
			pendingStickFrame = requestAnimationFrame(() => {
				pendingStickFrame = 0;
				if (!shouldStick) {
					return;
				}
				scrollToLatest(behavior, virtualizer);
				pendingStickFrameFollowUp = requestAnimationFrame(() => {
					pendingStickFrameFollowUp = 0;
					scrollToLatest(behavior, virtualizer);
				});
			});
		});
		hasInitialStick = true;
		return () => {
			if (pendingStickFrame !== 0) {
				cancelAnimationFrame(pendingStickFrame);
				pendingStickFrame = 0;
			}
			if (pendingStickFrameFollowUp !== 0) {
				cancelAnimationFrame(pendingStickFrameFollowUp);
				pendingStickFrameFollowUp = 0;
			}
			cancelPendingStickSettle();
			cancelPendingStickLock();
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
		bind:contentRef
		bind:virtualizerRef
		onVirtualSizeChange={handleVirtualSizeChange}
		virtual={virtualConfig}
	>
		{#snippet before()}
			{@render renderBefore?.()}
		{/snippet}

		{#snippet item(entry, index, _virtualItem)}
			{@render renderItem?.(entry, index)}
		{/snippet}

		{#snippet empty()}
			{@render renderEmpty?.()}
		{/snippet}

		{#snippet after()}
			{@render renderAfter?.()}
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
