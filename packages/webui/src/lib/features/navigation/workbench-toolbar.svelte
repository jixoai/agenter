<script lang="ts">
	import { onMount } from 'svelte';

	import { cn } from '$lib/utils.js';
	import type {
		WorkbenchToolbarBreakpoint,
		WorkbenchToolbarDensity,
		WorkbenchToolbarRenderState,
	} from './workbench-toolbar.types';

	const resolveBreakpoint = (width: number): WorkbenchToolbarBreakpoint => {
		if (width < 720) {
			return 'narrow';
		}
		if (width < 1080) {
			return 'compact';
		}
		return 'wide';
	};

	const resolveDensity = (breakpoint: WorkbenchToolbarBreakpoint): WorkbenchToolbarDensity => {
		if (breakpoint === 'narrow') {
			return 'dense';
		}
		if (breakpoint === 'compact') {
			return 'regular';
		}
		return 'relaxed';
	};

	let {
		class: className,
		content,
		navigation,
		primary,
		meta,
		actions,
	}: {
		class?: string;
		content?: import('svelte').Snippet<[WorkbenchToolbarRenderState]>;
		navigation?: import('svelte').Snippet<[WorkbenchToolbarRenderState]>;
		primary?: import('svelte').Snippet<[WorkbenchToolbarRenderState]>;
		meta?: import('svelte').Snippet<[WorkbenchToolbarRenderState]>;
		actions?: import('svelte').Snippet<[WorkbenchToolbarRenderState]>;
	} = $props();

	let rootRef = $state<HTMLElement | null>(null);
	let width = $state(0);

	const breakpoint = $derived(resolveBreakpoint(width));
	const density = $derived(resolveDensity(breakpoint));
	const toolbarState = $derived.by(
		() =>
			({
				width,
				breakpoint,
				density,
				isNarrow: breakpoint === 'narrow',
				isCompact: breakpoint !== 'wide',
				isWide: breakpoint === 'wide',
			}) satisfies WorkbenchToolbarRenderState,
	);
	const usesCompatibilityLayout = $derived(Boolean(!content && (navigation || primary || meta || actions)));

	onMount(() => {
		if (!rootRef || typeof ResizeObserver === 'undefined') {
			width = rootRef?.clientWidth ?? 0;
			return;
		}

		let frame = 0;
		const scheduleWidthCommit = (nextWidth: number): void => {
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
			frame = requestAnimationFrame(() => {
				frame = 0;
				if (nextWidth !== width) {
					width = nextWidth;
				}
			});
		};

		const observer = new ResizeObserver((entries) => {
			const nextWidth = Math.round(entries[0]?.contentRect.width ?? rootRef?.clientWidth ?? 0);
			scheduleWidthCommit(nextWidth);
		});
		observer.observe(rootRef);
		scheduleWidthCommit(rootRef.clientWidth);
		return () => {
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
			observer.disconnect();
		};
	});
</script>

<section
	bind:this={rootRef}
	class={cn('workbench-toolbar', className)}
	data-workbench-toolbar
	data-workbench-toolbar-breakpoint={breakpoint}
	data-workbench-toolbar-density={density}
>
	{#if content}
		<div class="workbench-toolbar__content" data-workbench-toolbar-region="content">
			{@render content(toolbarState)}
		</div>
	{:else if usesCompatibilityLayout}
		<div class="workbench-toolbar__compat" data-workbench-toolbar-region="compat">
			{#if navigation || primary || actions}
				<div
					class="workbench-toolbar__header"
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
						<div class="workbench-toolbar__primary" data-workbench-toolbar-region="primary">
							{@render primary(toolbarState)}
						</div>
					{/if}
					{#if actions}
						<div class="workbench-toolbar__actions" data-workbench-toolbar-region="actions">
							{@render actions(toolbarState)}
						</div>
					{/if}
				</div>
			{/if}

			{#if meta}
				<div class="workbench-toolbar__meta" data-workbench-toolbar-region="meta">
					{@render meta(toolbarState)}
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.workbench-toolbar,
	.workbench-toolbar__content,
	.workbench-toolbar__compat {
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}

	.workbench-toolbar {
		container-type: inline-size;
		inline-size: 100%;
		overflow: hidden;
	}

	.workbench-toolbar__content {
		display: block;
	}

	.workbench-toolbar__compat {
		display: grid;
		align-content: center;
		gap: 0.35rem;
		padding-inline: 0.75rem;
	}

	.workbench-toolbar__header {
		display: grid;
		align-items: center;
		gap: 0.75rem;
		min-inline-size: 0;
	}

	.workbench-toolbar__navigation,
	.workbench-toolbar__actions {
		display: flex;
		align-items: center;
	}

	.workbench-toolbar__primary,
	.workbench-toolbar__meta {
		min-inline-size: 0;
	}

	.workbench-toolbar__meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	@container (min-width: 42rem) {
		.workbench-toolbar__header[data-has-navigation='true'][data-has-actions='true'][data-has-primary='true'] {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}

		.workbench-toolbar__header[data-has-navigation='true'][data-has-actions='false'][data-has-primary='true'] {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.workbench-toolbar__header[data-has-navigation='false'][data-has-actions='true'][data-has-primary='true'] {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.workbench-toolbar__actions {
			justify-content: flex-end;
		}
	}

	@container (max-width: 41.999rem) {
		.workbench-toolbar__compat {
			padding-inline: 0.55rem;
		}

		.workbench-toolbar__header {
			gap: 0.45rem;
		}

		.workbench-toolbar__actions {
			flex-wrap: wrap;
			gap: 0.35rem;
		}
	}
</style>
