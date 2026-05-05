<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	import { cn } from '$lib/utils.js';

	import WorkbenchToolbarStructured from './workbench-toolbar-structured.svelte';
	import type {
		WorkbenchToolbarAnchorKind,
		WorkbenchToolbarBreakpoint,
		WorkbenchToolbarCollapseStage,
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

	const resolveStructuredStage = (width: number, hasPageTabs: boolean): WorkbenchToolbarCollapseStage => {
		if (!hasPageTabs) {
			return width < 760 ? 'overflow-secondary' : 'wide';
		}
		if (width < 520) {
			return 'overflow-identity';
		}
		if (width < 700) {
			return 'overflow-subtitle';
		}
		if (width < 940) {
			return 'overflow-secondary';
		}
		return 'wide';
	};

	// Shared toolbar responsiveness is platform law. Feature routes express one page-local
	// identity / status / action model here, while breakpoint collapse and overflow promotion
	// stay centralized instead of being reimplemented as bespoke mobile branches per page.

	const buildToolbarVisibility = ({
		stage,
		hasPageTabs,
		hasIdentity,
		hasIdentitySubtitle,
		hasActions,
		hasStatus,
	}: {
		stage: WorkbenchToolbarCollapseStage;
		hasPageTabs: boolean;
		hasIdentity: boolean;
		hasIdentitySubtitle: boolean;
		hasActions: boolean;
		hasStatus: boolean;
	}) => {
		const showInlineIdentity = !hasPageTabs || stage !== 'overflow-identity';
		const showInlineSubtitle = !hasPageTabs || stage === 'wide' || stage === 'overflow-secondary';
		const showInlineActions = stage === 'wide' || stage === 'overflow-secondary';
		const showInlineStatus = stage === 'wide' || (stage === 'overflow-secondary' && !hasActions);
		const hiddenIdentity =
			hasPageTabs && hasIdentity && (!showInlineIdentity || (hasIdentitySubtitle && !showInlineSubtitle));
		const hiddenActions = hasActions && !showInlineActions;
		const hiddenStatus = hasStatus && !showInlineStatus;

		return {
			showInlineIdentity,
			showInlineSubtitle,
			showInlineActions,
			showInlineStatus,
			showOverflowTrigger: hiddenIdentity || hiddenActions || hiddenStatus,
		};
	};

	let {
		class: className,
		content,
		pageTabs,
		identityLeading,
		identityTitle,
		identitySubtitle,
		navigation,
		primary,
		meta,
		actions,
		status,
		overflowLabel,
	}: {
		class?: string;
		content?: Snippet<[WorkbenchToolbarRenderState]>;
		pageTabs?: Snippet<[WorkbenchToolbarRenderState]>;
		identityLeading?: Snippet<[WorkbenchToolbarRenderState]>;
		identityTitle?: Snippet<[WorkbenchToolbarRenderState]>;
		identitySubtitle?: Snippet<[WorkbenchToolbarRenderState]>;
		navigation?: Snippet<[WorkbenchToolbarRenderState]>;
		primary?: Snippet<[WorkbenchToolbarRenderState]>;
		meta?: Snippet<[WorkbenchToolbarRenderState]>;
		actions?: Snippet<[WorkbenchToolbarRenderState]>;
		status?: Snippet<[WorkbenchToolbarRenderState]>;
		overflowLabel?: string;
	} = $props();

	let rootRef = $state<HTMLElement | null>(null);
	let width = $state(0);

	const hasStructuredIdentity = $derived(Boolean(identityLeading || identityTitle || identitySubtitle));
	const hasStructuredLayout = $derived(Boolean(!content && (pageTabs || hasStructuredIdentity || status)));
	const usesCompatibilityLayout = $derived(
		Boolean(!content && !hasStructuredLayout && (navigation || primary || meta || actions)),
	);
	const hasPageTabs = $derived(Boolean(pageTabs));
	const anchorKind = $derived.by(() => {
		if (hasPageTabs) {
			return 'page-tabs';
		}
		if (hasStructuredIdentity) {
			return 'identity';
		}
		return 'none';
	}) satisfies WorkbenchToolbarAnchorKind;
	const breakpoint = $derived(resolveBreakpoint(width));
	const density = $derived(resolveDensity(breakpoint));
	const collapseStage = $derived(resolveStructuredStage(width, hasPageTabs));
	const structuredVisibility = $derived(
		buildToolbarVisibility({
			stage: collapseStage,
			hasPageTabs,
			hasIdentity: hasStructuredIdentity,
			hasIdentitySubtitle: Boolean(identitySubtitle),
			hasActions: Boolean(actions),
			hasStatus: Boolean(status),
		}),
	);

	const inlineToolbarState = $derived.by(
		() =>
			({
				width,
				breakpoint,
				density,
				placement: 'inline',
				anchorKind,
				collapseStage,
				hasPageTabs,
				isNarrow: breakpoint === 'narrow',
				isCompact: breakpoint !== 'wide',
				isWide: breakpoint === 'wide',
				...structuredVisibility,
			}) satisfies WorkbenchToolbarRenderState,
	);
	const overflowToolbarState = $derived.by(
		() =>
			({
				...inlineToolbarState,
				placement: 'overflow',
			}) satisfies WorkbenchToolbarRenderState,
	);

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
	data-workbench-toolbar-layout={content ? 'content' : hasStructuredLayout ? 'structured' : usesCompatibilityLayout ? 'compat' : 'empty'}
>
	{#if content}
		<div class="workbench-toolbar__content" data-workbench-toolbar-region="content">
			{@render content(inlineToolbarState)}
		</div>
	{:else if hasStructuredLayout}
		<WorkbenchToolbarStructured
			inlineState={inlineToolbarState}
			overflowState={overflowToolbarState}
			{pageTabs}
			{identityLeading}
			{identityTitle}
			{identitySubtitle}
			{actions}
			{status}
			{overflowLabel}
		/>
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
							{@render navigation(inlineToolbarState)}
						</div>
					{/if}
					{#if primary}
						<div class="workbench-toolbar__primary" data-workbench-toolbar-region="primary">
							{@render primary(inlineToolbarState)}
						</div>
					{/if}
					{#if actions}
						<div class="workbench-toolbar__actions" data-workbench-toolbar-region="actions">
							{@render actions(inlineToolbarState)}
						</div>
					{/if}
				</div>
			{/if}

			{#if meta}
				<div class="workbench-toolbar__meta" data-workbench-toolbar-region="meta">
					{@render meta(inlineToolbarState)}
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
		overflow: visible;
		position: relative;
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
