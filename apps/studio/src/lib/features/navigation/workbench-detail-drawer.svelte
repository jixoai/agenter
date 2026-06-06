<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import type { Snippet } from 'svelte';

	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import { cn } from '$lib/utils.js';

	let {
		title,
		description,
		tone = 'pane',
		scrollBody = true,
		class: className,
		contentClass,
		summaryClass,
		'data-testid': testId,
		children,
		summary,
		titleAccessory,
		titleMeta,
	}: {
		title: string;
		description?: string;
		tone?: 'page' | 'pane';
		scrollBody?: boolean;
		class?: string;
		contentClass?: string;
		summaryClass?: string;
		'data-testid'?: string;
		children?: Snippet;
		summary?: Snippet;
		titleAccessory?: Snippet;
		titleMeta?: Snippet;
	} = $props();
</script>

{#snippet header()}
	<div class="grid gap-1">
		<div class="flex min-w-0 items-center gap-2">
			<h3 class="truncate text-sm font-semibold">{title}</h3>
			{@render titleAccessory?.()}
		</div>
		{#if description}
			<p class="text-sm text-muted-foreground">{description}</p>
		{/if}
		{@render titleMeta?.()}
	</div>
{/snippet}

{#snippet footer()}
	<div
		class={cn(
			'grid gap-2 text-xs leading-5 text-muted-foreground',
			summaryClass,
		)}
		data-workbench-detail-drawer-region="summary"
	>
		{@render summary?.()}
	</div>
{/snippet}

<WorkbenchScaffold
	{tone}
	class={cn('workbench-detail-drawer', className)}
	bodyClass="h-full"
	data-testid={testId}
	header={header}
	footer={summary ? footer : undefined}
>
	{#if scrollBody}
		<ScrollView
			class="h-full"
			contentClass={cn('grid gap-4 p-4', contentClass)}
		>
			{@render children?.()}
		</ScrollView>
	{:else}
		<div class={cn('workbench-detail-drawer__body', contentClass)}>
			{@render children?.()}
		</div>
	{/if}
</WorkbenchScaffold>

<style>
	.workbench-detail-drawer {
		min-block-size: 0;
		min-inline-size: 0;
		block-size: 100%;
	}

	.workbench-detail-drawer__body {
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}
</style>
