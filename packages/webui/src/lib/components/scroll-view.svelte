<script lang="ts" generics="Item">
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';
	import { cn } from '$lib/utils.js';

	type ScrollOrientation = 'vertical' | 'horizontal' | 'both';

	interface VirtualConfig<TItem> {
		items: TItem[];
		itemSize: number;
		overscan?: number;
	}

	let {
		class: className,
		viewportClass = '',
		contentClass = '',
		orientation = 'vertical',
		virtual = undefined,
		children,
		item,
		empty,
	}: {
		class?: string;
		viewportClass?: string;
		contentClass?: string;
		orientation?: ScrollOrientation;
		virtual?: VirtualConfig<Item>;
		children?: import('svelte').Snippet;
		item?: import('svelte').Snippet<[Item, number]>;
		empty?: import('svelte').Snippet;
	} = $props();

	let viewportRef = $state<HTMLElement | null>(null);
	let viewportSize = $state(0);
	let scrollOffset = $state(0);

	const virtualItems = $derived.by(() => {
		if (!virtual) {
			return [];
		}
		const overscan = Math.max(0, virtual.overscan ?? 4);
		const size = Math.max(virtual.itemSize, 1);
		const visibleCount = Math.ceil(Math.max(viewportSize, size) / size);
		const start = Math.max(0, Math.floor(scrollOffset / size) - overscan);
		const end = Math.min(virtual.items.length, start + visibleCount + overscan * 2);
		return virtual.items.slice(start, end).map((value, index) => ({
			value,
			index: start + index,
			offset: (start + index) * size,
		}));
	});

	const totalVirtualSize = $derived(virtual ? virtual.items.length * virtual.itemSize : 0);

	const syncViewportMetrics = (): void => {
		if (!viewportRef) {
			return;
		}
		viewportSize =
			orientation === 'horizontal' ? viewportRef.clientWidth : viewportRef.clientHeight;
		scrollOffset =
			orientation === 'horizontal' ? viewportRef.scrollLeft : viewportRef.scrollTop;
	};

	$effect(() => {
		if (!viewportRef) {
			return;
		}
		syncViewportMetrics();
		const handleScroll = (): void => {
			syncViewportMetrics();
		};
		const resizeObserver = new ResizeObserver(() => {
			syncViewportMetrics();
		});
		resizeObserver.observe(viewportRef);
		viewportRef.addEventListener('scroll', handleScroll, { passive: true });
		return () => {
			viewportRef?.removeEventListener('scroll', handleScroll);
			resizeObserver.disconnect();
		};
	});
</script>

<ScrollArea.Root
	bind:viewportRef={viewportRef}
	orientation={orientation}
	class={cn('h-full min-w-0 min-h-0', className)}
	scrollbarXClasses="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)]"
	scrollbarYClasses="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)]"
>
	<div
		class={cn(
			'h-full min-w-0',
			orientation === 'horizontal' ? 'w-max' : 'min-h-full',
			viewportClass,
		)}
	>
		{#if virtual && item}
			{#if virtual.items.length === 0}
				{@render empty?.()}
			{:else}
				<div
					class={cn('relative', contentClass)}
					style={`${
						orientation === 'horizontal'
							? `width:${totalVirtualSize}px;height:100%;`
							: `height:${totalVirtualSize}px;`
					}`}
				>
					{#each virtualItems as row (row.index)}
						<div
							class="absolute left-0 top-0 w-full"
							style={`transform:translate${orientation === 'horizontal' ? 'X' : 'Y'}(${row.offset}px);${
								orientation === 'horizontal'
									? `width:${virtual.itemSize}px;height:100%;`
									: `height:${virtual.itemSize}px;`
							}`}
						>
							{@render item(row.value, row.index)}
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<div class={cn('min-h-full min-w-0', contentClass)}>
				{@render children?.()}
			</div>
		{/if}
	</div>
</ScrollArea.Root>
