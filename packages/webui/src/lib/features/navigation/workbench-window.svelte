<script lang="ts">
	import { ClipSurface, ScrollView } from '@agenter/svelte-components';
	import XIcon from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import WorkbenchTabStrip, { type WorkbenchTabItem } from './workbench-tab-strip.svelte';
	import { setWorkbenchPageToolbarRegistry } from './workbench-page-toolbar-context.svelte';

	let {
		ariaLabel,
		value,
		tabs,
		onValueChange,
		toolbar,
		bodyMode = 'scroll',
		bodyClass,
		chromeClass,
		class: className,
		children,
	}: {
		ariaLabel: string;
		value: string;
		tabs: WorkbenchTabItem[];
		onValueChange?: (value: string) => void | Promise<void>;
		toolbar?: Snippet;
		bodyMode?: 'scroll' | 'fill';
		bodyClass?: string;
		chromeClass?: string;
		class?: string;
		children?: Snippet;
	} = $props();

	const pageToolbarRegistry = setWorkbenchPageToolbarRegistry();
	const pageToolbarOwner = $derived.by(() => {
		if (pageToolbarRegistry.takeover) {
			return 'takeover';
		}
		if (pageToolbarRegistry.portalOwnerCount > 0) {
			return 'page';
		}
		if (toolbar) {
			return 'local';
		}
		return 'none';
	});
</script>

<div
	class={cn('workbench-window grid h-full', className)}
	data-workbench-window
>
	<WorkbenchTabStrip
		{ariaLabel}
		{value}
		{tabs}
		{onValueChange}
		class={chromeClass}
		fusedBelow
	/>

	<section
		class="workbench-page-toolbar border-x border-b border-border/65 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_14%)_0%,color-mix(in_srgb,var(--card),white_5%)_58%,color-mix(in_srgb,var(--background),transparent_8%)_100%)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_56%),0_22px_44px_-40px_color-mix(in_srgb,var(--foreground),transparent_16%)]"
		data-workbench-page-toolbar
		data-toolbar-owner={pageToolbarOwner}
	>
		{#if pageToolbarRegistry.takeover}
			<div class="workbench-page-toolbar-takeover">
				<Button
					variant="ghost"
					size="sm"
					class="justify-start gap-2 rounded-full"
					onclick={() => pageToolbarRegistry.takeover?.onClose()}
				>
					<XIcon class="size-4" />
					{pageToolbarRegistry.takeover.label ?? 'Close detail'}
				</Button>
			</div>
		{:else}
			{#if pageToolbarOwner === 'local' && toolbar}
				<div class="workbench-page-toolbar-local">
					{@render toolbar()}
				</div>
			{/if}
			<div bind:this={pageToolbarRegistry.host} class="workbench-page-toolbar-host"></div>
		{/if}
	</section>

	<ClipSurface
		class={cn(
			'workbench-window-body rounded-b-[1.35rem] border border-border/65 border-t-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_6%)_0%,var(--card)_16%,color-mix(in_srgb,var(--background),var(--card)_42%)_100%)] shadow-[0_30px_60px_-44px_color-mix(in_srgb,var(--foreground),transparent_18%)]',
			bodyClass,
		)}
		data-workbench-window-body
	>
		{#if bodyMode === 'scroll'}
			<ScrollView
				class="workbench-window-scroll"
				viewportClass="workbench-window-scroll-viewport"
				contentClass="workbench-window-scroll-content"
				viewportTestId="workbench-window-body-scroll-viewport"
			>
				<div class="workbench-window-content" data-workbench-window-content>
					{#key value}
						{@render children?.()}
					{/key}
				</div>
			</ScrollView>
		{:else}
			<div class="workbench-window-fill" data-workbench-window-fill>
				<div class="workbench-window-content" data-workbench-window-content>
					{#key value}
						{@render children?.()}
					{/key}
				</div>
			</div>
		{/if}
	</ClipSurface>
</div>

<style>
	.workbench-window {
		inline-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		grid-template-rows: auto auto minmax(0, 1fr);
	}

	.workbench-page-toolbar,
	.workbench-window-body,
	.workbench-window-fill,
	.workbench-window-scroll,
	.workbench-window-scroll-content,
	.workbench-window-content {
		min-block-size: 0;
		min-inline-size: 0;
	}

	.workbench-page-toolbar {
		block-size: 48px;
		container-type: inline-size;
		container-name: workbench-page-toolbar;
		overflow: visible;
		position: relative;
		z-index: 1;
	}

	.workbench-page-toolbar[data-toolbar-owner='none'] {
		display: none;
	}

	.workbench-page-toolbar[data-toolbar-owner='takeover'] {
		z-index: 60;
	}

	.workbench-page-toolbar-local,
	.workbench-page-toolbar-host {
		display: block;
		block-size: 100%;
		inline-size: 100%;
		min-inline-size: 0;
	}

	.workbench-page-toolbar-host:empty {
		display: none;
	}

	.workbench-page-toolbar-takeover {
		display: flex;
		block-size: 100%;
		align-items: center;
		padding-inline: 0.75rem;
		pointer-events: auto;
		position: relative;
		z-index: 61;
	}

	.workbench-window-body,
	.workbench-window-fill,
	.workbench-window-scroll {
		block-size: 100%;
	}

	.workbench-window-fill,
	.workbench-window-scroll-content,
	.workbench-window-content {
		display: grid;
		min-block-size: 100%;
	}
</style>
