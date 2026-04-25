<script lang="ts">
	import type { WorkbenchSplitDetailRatioPersistence } from '@agenter/svelte-components';
	import type { Snippet } from 'svelte';

	import { cn } from '$lib/utils.js';
	import WorkbenchSplitDetailHost from './workbench-split-detail-host.svelte';

	let {
		class: className,
		gridClass,
		mainClass,
		bottomClass,
		drawerClass,
		desktopColumnsClass = 'lg:grid-cols-[minmax(0,1fr)_22rem]',
		desktopRowsClass = 'lg:grid-rows-[minmax(0,1fr)_auto]',
		detailLayout = 'static',
		detailOpen = $bindable(false),
		detailCompact = $bindable(false),
		detailRatioPersistence = null,
		detailLeftMin = 380,
		detailRightMin = 280,
		detailHandleSize = 12,
		detailDefaultRatio = 0.625,
		detailCompactThreshold,
		detailCloseLabel = 'Close detail',
		detailSheetClass = 'z-40 w-full max-w-full p-0 sm:w-[min(32rem,calc(100%-0.75rem))] sm:max-w-none',
		'data-testid': testId,
		main,
		bottom,
		drawer,
	}: {
		class?: string;
		gridClass?: string;
		mainClass?: string;
		bottomClass?: string;
		drawerClass?: string;
		desktopColumnsClass?: string;
		desktopRowsClass?: string;
		detailLayout?: 'static' | 'split-detail';
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
		'data-testid'?: string;
		main?: Snippet;
		bottom?: Snippet;
		drawer?: Snippet;
	} = $props();

	const usesSplitDetailLayout = $derived(detailLayout === 'split-detail' && Boolean(drawer));

	$effect(() => {
		if (usesSplitDetailLayout) {
			return;
		}
		detailCompact = false;
		detailOpen = false;
	});
</script>

<div class={cn('workbench-page-content', className)} data-testid={testId} data-workbench-page-content>
	{#if usesSplitDetailLayout}
		<WorkbenchSplitDetailHost
			gridClass={gridClass}
			{mainClass}
			{bottomClass}
			{drawerClass}
			bind:detailOpen
			bind:detailCompact
			detailRatioPersistence={detailRatioPersistence}
			detailLeftMin={detailLeftMin}
			detailRightMin={detailRightMin}
			detailHandleSize={detailHandleSize}
			detailDefaultRatio={detailDefaultRatio}
			detailCompactThreshold={detailCompactThreshold}
			detailCloseLabel={detailCloseLabel}
			detailSheetClass={detailSheetClass}
			{main}
			{bottom}
			{drawer}
		/>
	{:else}
		<div
			class={cn('workbench-page-content__grid', desktopColumnsClass, desktopRowsClass, gridClass)}
			data-workbench-page-content-grid
		>
			<section
				class={cn('workbench-page-content__main', mainClass)}
				data-workbench-page-content-region="main"
			>
				{@render main?.()}
			</section>

			{#if bottom}
				<section
					class={cn('workbench-page-content__bottom lg:col-start-1 lg:row-start-2', bottomClass)}
					data-workbench-page-content-region="bottom"
				>
					{@render bottom()}
				</section>
			{/if}

			{#if drawer}
				<aside
					class={cn('workbench-page-content__drawer lg:col-start-2 lg:row-span-2', drawerClass)}
					data-workbench-page-content-region="drawer"
				>
					{@render drawer()}
				</aside>
			{/if}
		</div>
	{/if}
</div>

<style>
	.workbench-page-content,
	.workbench-page-content__grid,
	.workbench-page-content__main,
	.workbench-page-content__bottom {
		min-block-size: 0;
		min-inline-size: 0;
	}

	:global(.workbench-page-content__split-root),
	:global(.workbench-page-content__split-main),
	:global(.workbench-page-content__drawer) {
		min-block-size: 0;
		min-inline-size: 0;
	}

	.workbench-page-content {
		block-size: 100%;
		isolation: isolate;
		position: relative;
	}

	.workbench-page-content__grid {
		display: grid;
		block-size: 100%;
		gap: 1rem;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto auto auto;
	}
	</style>
