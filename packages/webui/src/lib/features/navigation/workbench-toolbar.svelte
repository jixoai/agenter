<script lang="ts">
	import { onMount } from 'svelte';

	import { cn } from '$lib/utils.js';
	import type { WorkbenchToolbarBreakpoint, WorkbenchToolbarRenderState } from './workbench-toolbar.types';

	const resolveBreakpoint = (width: number): WorkbenchToolbarBreakpoint => {
		if (width < 720) {
			return 'narrow';
		}
		if (width < 1080) {
			return 'compact';
		}
		return 'wide';
	};

	let {
		class: className,
		fixed = true,
		rows = 'auto',
		navigation,
		primary,
		meta,
		actions,
	}: {
		class?: string;
		fixed?: boolean;
		rows?: 'auto' | 1 | 2;
		navigation?: import('svelte').Snippet<[WorkbenchToolbarRenderState]>;
		primary?: import('svelte').Snippet<[WorkbenchToolbarRenderState]>;
		meta?: import('svelte').Snippet<[WorkbenchToolbarRenderState]>;
		actions?: import('svelte').Snippet<[WorkbenchToolbarRenderState]>;
	} = $props();

	let rootRef = $state<HTMLElement | null>(null);
	let width = $state(0);

	const hasHeader = $derived(Boolean(navigation || primary || actions));
	const effectiveRows = $derived.by(() => {
		if (rows !== 'auto') {
			return rows;
		}
		return hasHeader && meta ? 2 : 1;
	});
	const breakpoint = $derived(resolveBreakpoint(width));
	const toolbarState = $derived.by(
		() =>
			({
				width,
				breakpoint,
				rows: effectiveRows,
				fixed,
				isNarrow: breakpoint === 'narrow',
				isCompact: breakpoint !== 'wide',
				isWide: breakpoint === 'wide',
			}) satisfies WorkbenchToolbarRenderState,
	);

	onMount(() => {
		if (!rootRef || typeof ResizeObserver === 'undefined') {
			width = rootRef?.clientWidth ?? 0;
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const nextWidth = Math.round(entries[0]?.contentRect.width ?? rootRef?.clientWidth ?? 0);
			if (nextWidth !== width) {
				width = nextWidth;
			}
		});
		observer.observe(rootRef);
		width = rootRef.clientWidth;
		return () => observer.disconnect();
	});
</script>

<section
	bind:this={rootRef}
	class={cn('workbench-toolbar grid', className)}
	data-workbench-toolbar
	data-workbench-toolbar-breakpoint={breakpoint}
	data-workbench-toolbar-rows={String(effectiveRows)}
	data-workbench-toolbar-fixed={fixed ? 'true' : 'false'}
>
	{#if navigation || primary || actions}
		<div
			class="workbench-toolbar__header grid gap-3"
			data-has-navigation={navigation ? 'true' : 'false'}
			data-has-actions={actions ? 'true' : 'false'}
			data-has-primary={primary ? 'true' : 'false'}
		>
			{#if navigation}
				<div class="workbench-toolbar__navigation" data-workbench-toolbar-region="navigation">
					{@render navigation(toolbarState)}
				</div>
			{/if}
			{#if primary}
				<div class="workbench-toolbar__primary min-w-0" data-workbench-toolbar-region="primary">
					{@render primary(toolbarState)}
				</div>
			{/if}
			{#if actions}
				<div
					class="workbench-toolbar__actions flex flex-wrap items-center gap-2"
					data-workbench-toolbar-region="actions"
				>
					{@render actions(toolbarState)}
				</div>
			{/if}
		</div>
	{/if}

	{#if meta}
		<div class="workbench-toolbar__meta flex flex-wrap items-center gap-2" data-workbench-toolbar-region="meta">
			{@render meta(toolbarState)}
		</div>
	{/if}
</section>

<style>
	.workbench-toolbar {
		container-type: inline-size;
		inline-size: 100%;
		min-inline-size: 0;
		padding: 0.9rem 1rem;
		gap: 0.75rem;
		overflow: clip;
	}

	.workbench-toolbar[data-workbench-toolbar-fixed='true'][data-workbench-toolbar-rows='1'] {
		block-size: 4.25rem;
		align-content: center;
	}

	.workbench-toolbar[data-workbench-toolbar-fixed='true'][data-workbench-toolbar-rows='2'] {
		grid-template-rows: minmax(0, 1fr) auto;
		block-size: 7.5rem;
	}

	.workbench-toolbar[data-workbench-toolbar-fixed='true'][data-workbench-toolbar-breakpoint='compact'][data-workbench-toolbar-rows='2'] {
		block-size: 8rem;
	}

	.workbench-toolbar[data-workbench-toolbar-fixed='true'][data-workbench-toolbar-breakpoint='narrow'][data-workbench-toolbar-rows='2'] {
		block-size: 8.75rem;
		padding-block: 0.75rem;
	}

	.workbench-toolbar__header {
		min-block-size: 0;
		align-items: center;
		gap: 0.875rem;
	}

	.workbench-toolbar__navigation {
		display: flex;
		align-items: center;
	}

	.workbench-toolbar__primary {
		display: grid;
		align-content: center;
		gap: 0.25rem;
	}

	.workbench-toolbar__actions {
		align-items: center;
	}

	.workbench-toolbar__meta {
		min-block-size: 0;
		align-items: center;
		border-top: 1px solid color-mix(in srgb, var(--border), transparent 38%);
		padding-top: 0.7rem;
		min-height: 0;
	}

	.workbench-toolbar[data-workbench-toolbar-rows='1'] .workbench-toolbar__meta {
		border-top: 0;
		padding-top: 0;
	}

	@container (min-width: 42rem) {
		.workbench-toolbar__header[data-has-navigation='true'][data-has-actions='true'][data-has-primary='true'] {
			align-items: start;
			grid-template-columns: auto minmax(0, 1fr) auto;
		}

		.workbench-toolbar__header[data-has-navigation='true'][data-has-actions='false'][data-has-primary='true'] {
			align-items: start;
			grid-template-columns: auto minmax(0, 1fr);
		}

		.workbench-toolbar__header[data-has-navigation='false'][data-has-actions='true'][data-has-primary='true'] {
			align-items: start;
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.workbench-toolbar__actions {
			justify-content: flex-end;
		}
	}

	@container (min-width: 58rem) {
		.workbench-toolbar__meta {
			padding-top: 0.85rem;
		}
	}

	@container (max-width: 44.999rem) {
		.workbench-toolbar {
			padding-inline: 0.85rem;
		}

		.workbench-toolbar__header {
			gap: 0.7rem;
		}

		.workbench-toolbar__actions {
			justify-content: flex-start;
		}
	}
</style>
