<script lang="ts">
	import { ClipSurface } from '@agenter/svelte-components';

	import WorkbenchTabStrip, { type WorkbenchTabItem } from './workbench-tab-strip.svelte';
	import { setWorkbenchPageToolbarRegistry } from './workbench-page-toolbar-context.svelte';
	import { cn } from '$lib/utils.js';

	let {
		ariaLabel,
		value,
		tabs,
		onValueChange,
		toolbar,
		bodyClass,
		chromeClass,
		class: className,
		children,
	}: {
		ariaLabel: string;
		value: string;
		tabs: WorkbenchTabItem[];
		onValueChange?: (value: string) => void | Promise<void>;
		toolbar?: import('svelte').Snippet;
		bodyClass?: string;
		chromeClass?: string;
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();

	const pageToolbarRegistry = setWorkbenchPageToolbarRegistry();
	const effectiveToolbar = $derived(pageToolbarRegistry.content ?? toolbar ?? null);
</script>

<div
	class={cn('workbench-window grid h-full', className)}
	data-workbench-window
	data-has-toolbar={effectiveToolbar ? 'true' : 'false'}
>
	<WorkbenchTabStrip
		{ariaLabel}
		{value}
		{tabs}
		{onValueChange}
		class={chromeClass}
		fusedBelow
	/>

	{#if effectiveToolbar}
		<section
			class="workbench-page-toolbar border-x border-b border-border/65 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_14%)_0%,color-mix(in_srgb,var(--card),white_5%)_58%,color-mix(in_srgb,var(--background),transparent_8%)_100%)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_56%),0_22px_44px_-40px_color-mix(in_srgb,var(--foreground),transparent_16%)]"
			data-workbench-page-toolbar
		>
			{@render effectiveToolbar()}
		</section>
	{/if}

	<ClipSurface
		class={cn(
			'workbench-window-body rounded-b-[1.35rem] border border-border/65 border-t-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_6%)_0%,var(--card)_16%,color-mix(in_srgb,var(--background),var(--card)_42%)_100%)] shadow-[0_30px_60px_-44px_color-mix(in_srgb,var(--foreground),transparent_18%)]',
			bodyClass,
		)}
		data-workbench-window-body
	>
		<div class="workbench-window-content h-full" data-workbench-window-content>
			{@render children?.()}
		</div>
	</ClipSurface>
</div>

<style>
	.workbench-window {
		min-block-size: 0;
		min-inline-size: 0;
		grid-template-rows: auto minmax(0, 1fr);
	}

	.workbench-window[data-has-toolbar='true'] {
		grid-template-rows: auto auto minmax(0, 1fr);
	}

	.workbench-page-toolbar,
	.workbench-window-body,
	.workbench-window-content {
		min-block-size: 0;
		min-inline-size: 0;
	}

	.workbench-page-toolbar {
		block-size: 3rem;
	}

	.workbench-window-body,
	.workbench-window-content {
		block-size: 100%;
	}
</style>
