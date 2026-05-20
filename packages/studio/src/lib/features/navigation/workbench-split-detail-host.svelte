<script lang="ts">
	import { WorkbenchSplitDetail, type WorkbenchSplitDetailRatioPersistence } from '@agenter/svelte-components';
	import type { Snippet } from 'svelte';

	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { cn } from '$lib/utils.js';
	import { getWorkbenchPageToolbarRegistry } from './workbench-page-toolbar-context.svelte';

	let {
		gridClass,
		mainClass,
		bottomClass,
		drawerClass,
		detailOpen = $bindable(true),
		detailCompact = $bindable(false),
		detailRatioPersistence = null,
		detailLeftMin = 380,
		detailRightMin = 280,
		detailHandleSize = 12,
		detailDefaultRatio = 0.625,
		detailCompactThreshold,
		detailCloseLabel = 'Close detail',
		detailSheetClass = 'z-40 w-full max-w-full p-0 sm:w-[min(32rem,calc(100%-0.75rem))] sm:max-w-none',
		main,
		bottom,
		drawer,
	}: {
		gridClass?: string;
		mainClass?: string;
		bottomClass?: string;
		drawerClass?: string;
		detailOpen?: boolean;
		detailCompact?: boolean;
		detailRatioPersistence?: WorkbenchSplitDetailRatioPersistence;
		detailLeftMin?: number;
		detailRightMin?: number;
		detailHandleSize?: number;
		detailDefaultRatio?: number;
		detailCompactThreshold?: number;
		detailCloseLabel?: string;
		detailSheetClass?: string;
		main?: Snippet;
		bottom?: Snippet;
		drawer?: Snippet;
	} = $props();

	const toolbarRegistry = getWorkbenchPageToolbarRegistry();
	let lastCompact = $state(false);
	let detailSheetHost = $state<HTMLElement | null>(null);

	$effect(() => {
		if (detailCompact && !lastCompact) {
			detailOpen = false;
		}
		lastCompact = detailCompact;
	});

	$effect(() => {
		if (!toolbarRegistry || !detailCompact || !detailOpen) {
			return;
		}
		const takeover = {
			kind: 'close-only' as const,
			label: detailCloseLabel,
			onClose: () => {
				detailOpen = false;
			},
		};
		toolbarRegistry.takeover = takeover;
		return () => {
			if (toolbarRegistry.takeover === takeover) {
				toolbarRegistry.takeover = null;
			}
		};
	});
</script>

<WorkbenchSplitDetail.Root
	bind:compact={detailCompact}
	detailVisible={!detailCompact && detailOpen}
	class={cn('workbench-page-content__split-root', gridClass)}
	ratioPersistence={detailRatioPersistence}
	leftMin={detailLeftMin}
	rightMin={detailRightMin}
	handleSize={detailHandleSize}
	defaultRatio={detailDefaultRatio}
	compactThreshold={detailCompactThreshold}
	data-workbench-page-content-grid
>
	<WorkbenchSplitDetail.Main class="workbench-page-content__split-main" data-has-bottom={bottom ? 'true' : 'false'}>
		<section class={cn('workbench-page-content__main', mainClass)} data-workbench-page-content-region="main">
			{@render main?.()}
		</section>

		{#if bottom}
			<section
				class={cn('workbench-page-content__bottom', bottomClass)}
				data-workbench-page-content-region="bottom"
			>
				{@render bottom()}
			</section>
		{/if}
	</WorkbenchSplitDetail.Main>

	{#if !detailCompact && detailOpen}
		<WorkbenchSplitDetail.Handle />
		<WorkbenchSplitDetail.Detail
			class={cn('workbench-page-content__drawer', drawerClass)}
			data-workbench-page-content-region="drawer"
		>
			{@render drawer?.()}
		</WorkbenchSplitDetail.Detail>
	{/if}
</WorkbenchSplitDetail.Root>

{#if detailCompact && detailOpen}
	<div bind:this={detailSheetHost} class="workbench-page-content__detail-sheet-layer"></div>
	<Sheet.Root bind:open={detailOpen}>
		<Sheet.Content
			side="right"
			class={cn('workbench-page-content__detail-sheet-content', detailSheetClass)}
			overlayClass="workbench-page-content__detail-sheet-overlay z-30"
			portalProps={detailSheetHost ? { to: detailSheetHost } : undefined}
			showDefaultClose={false}
		>
			<div class="workbench-page-content__detail-sheet">
				{@render drawer?.()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

<style>
	:global(.workbench-page-content__split-root),
	:global(.workbench-page-content__split-main),
	:global(.workbench-page-content__drawer) {
		min-block-size: 0;
		min-inline-size: 0;
	}

	:global(.workbench-page-content__split-root) {
		block-size: 100%;
	}

	:global(.workbench-page-content__split-main) {
		display: grid;
		block-size: 100%;
		gap: 1rem;
	}

	:global(.workbench-page-content__split-main[data-has-bottom='true']) {
		grid-template-rows: minmax(0, 1fr) auto;
	}

	:global(.workbench-page-content__split-main[data-has-bottom='false']) {
		grid-template-rows: minmax(0, 1fr);
	}

	.workbench-page-content__detail-sheet {
		block-size: 100%;
		min-block-size: 45dvh;
		min-inline-size: 0;
	}

	.workbench-page-content__detail-sheet-layer {
		inset: 0;
		isolation: isolate;
		pointer-events: none;
		position: absolute;
		transform: translateZ(0);
	}

	:global(.workbench-page-content__detail-sheet-overlay),
	:global(.workbench-page-content__detail-sheet-content) {
		pointer-events: auto;
	}
</style>
