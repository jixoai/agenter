<script lang="ts">
	import type { Snippet } from 'svelte';

	import { cn } from '$lib/utils.js';

	let {
		class: className,
		gridClass,
		mainClass,
		bottomClass,
		drawerClass,
		desktopColumnsClass = 'lg:grid-cols-[minmax(0,1fr)_22rem]',
		desktopRowsClass = 'lg:grid-rows-[minmax(0,1fr)_auto]',
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
		'data-testid'?: string;
		main?: Snippet;
		bottom?: Snippet;
		drawer?: Snippet;
	} = $props();
</script>

<div class={cn('workbench-page-content', className)} data-testid={testId} data-workbench-page-content>
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
</div>

<style>
	.workbench-page-content,
	.workbench-page-content__grid,
	.workbench-page-content__main,
	.workbench-page-content__bottom,
	.workbench-page-content__drawer {
		min-block-size: 0;
		min-inline-size: 0;
	}

	.workbench-page-content {
		block-size: 100%;
	}

	.workbench-page-content__grid {
		display: grid;
		block-size: 100%;
		gap: 1rem;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto auto auto;
	}
	</style>
