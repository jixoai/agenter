<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import type { Snippet } from 'svelte';

	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import { cn } from '$lib/utils.js';

	let {
		title,
		description,
		tone = 'pane',
		class: className,
		contentClass,
		summaryClass,
		'data-testid': testId,
		children,
		summary,
	}: {
		title: string;
		description?: string;
		tone?: 'page' | 'pane';
		class?: string;
		contentClass?: string;
		summaryClass?: string;
		'data-testid'?: string;
		children?: Snippet;
		summary?: Snippet;
	} = $props();
</script>

{#snippet header()}
	<div class="grid gap-1">
		<h3 class="text-sm font-semibold">{title}</h3>
		{#if description}
			<p class="text-sm text-muted-foreground">{description}</p>
		{/if}
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
	<ScrollView
		class="h-full"
		contentClass={cn('grid gap-4 p-4', contentClass)}
	>
		{@render children?.()}
	</ScrollView>
</WorkbenchScaffold>

<style>
	.workbench-detail-drawer {
		min-block-size: 0;
		min-inline-size: 0;
		block-size: 100%;
	}
</style>
