<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import CircleEllipsisIcon from '@lucide/svelte/icons/circle-ellipsis';
	import type { Snippet } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	import type { WorkbenchToolbarRenderState } from './workbench-toolbar.types';

	let {
		class: className,
		inlineState,
		overflowState,
		pageTabs,
		identityLeading,
		identityTitle,
		identitySubtitle,
		actions,
		status,
		overflowLabel = 'Open page toolbar details',
	}: {
		class?: string;
		inlineState: WorkbenchToolbarRenderState;
		overflowState: WorkbenchToolbarRenderState;
		pageTabs?: Snippet<[WorkbenchToolbarRenderState]>;
		identityLeading?: Snippet<[WorkbenchToolbarRenderState]>;
		identityTitle?: Snippet<[WorkbenchToolbarRenderState]>;
		identitySubtitle?: Snippet<[WorkbenchToolbarRenderState]>;
		actions?: Snippet<[WorkbenchToolbarRenderState]>;
		status?: Snippet<[WorkbenchToolbarRenderState]>;
		overflowLabel?: string;
	} = $props();

	let rootRef = $state<HTMLElement | null>(null);
	let overflowOpen = $state(false);
	let overflowIdentityProbe = $state<HTMLElement | null>(null);
	let overflowActionsProbe = $state<HTMLElement | null>(null);
	let overflowStatusProbe = $state<HTMLElement | null>(null);
	let hasMeasuredOverflowIdentity = $state(false);
	let hasMeasuredOverflowActions = $state(false);
	let hasMeasuredOverflowStatus = $state(false);
	const uid = $props.id();
	const overflowPanelId = `${uid}-overflow-panel`;

	const hasPageTabs = $derived(Boolean(pageTabs));
	const hasIdentityBody = $derived(Boolean(identityTitle || identitySubtitle));
	const hasIdentity = $derived(Boolean(identityLeading || hasIdentityBody));
	const showInlineIdentity = $derived(hasIdentity && (!hasPageTabs || inlineState.showInlineIdentity));
	const showInlineSubtitle = $derived(Boolean(identitySubtitle && showInlineIdentity && inlineState.showInlineSubtitle));
	const showInlineActions = $derived(Boolean(actions && inlineState.showInlineActions));
	const showInlineStatus = $derived(Boolean(status && inlineState.showInlineStatus));
	const showInlineStatusInIdentity = $derived(Boolean(showInlineStatus && showInlineIdentity && identityTitle));
	const showInlineStatusInRight = $derived(Boolean(showInlineStatus && !showInlineStatusInIdentity));
	const showOverflowIdentity = $derived(
		Boolean(
			hasPageTabs &&
				hasIdentity &&
				((identitySubtitle && !inlineState.showInlineSubtitle) || !inlineState.showInlineIdentity),
		),
	);
	const showOverflowActions = $derived(Boolean(actions && !inlineState.showInlineActions));
	const showOverflowStatus = $derived(Boolean(status && !inlineState.showInlineStatus));
	const hasOverflowCandidate = $derived(Boolean(showOverflowIdentity || showOverflowActions || showOverflowStatus));
	const hasOverflowContent = $derived(
		Boolean(hasMeasuredOverflowIdentity || hasMeasuredOverflowActions || hasMeasuredOverflowStatus),
	);

	const probeHasRenderableContent = (node: HTMLElement | null): boolean => {
		if (!node) {
			return false;
		}
		return node.childElementCount > 0 || Boolean(node.textContent?.trim().length);
	};

	$effect(() => {
		if (hasOverflowContent) {
			return;
		}
		overflowOpen = false;
	});

	$effect(() => {
		if (!overflowOpen || typeof document === 'undefined') {
			return;
		}

		const handlePointerDown = (event: PointerEvent): void => {
			const target = event.target;
			if (!(target instanceof Node)) {
				return;
			}
			if (!rootRef?.contains(target)) {
				overflowOpen = false;
			}
		};
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				overflowOpen = false;
			}
		};

		document.addEventListener('pointerdown', handlePointerDown, true);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown, true);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	$effect(() => {
		if (!hasOverflowCandidate) {
			hasMeasuredOverflowIdentity = false;
			hasMeasuredOverflowActions = false;
			hasMeasuredOverflowStatus = false;
			return;
		}

		const measure = (): void => {
			hasMeasuredOverflowIdentity = showOverflowIdentity && probeHasRenderableContent(overflowIdentityProbe);
			hasMeasuredOverflowActions = showOverflowActions && probeHasRenderableContent(overflowActionsProbe);
			hasMeasuredOverflowStatus = showOverflowStatus && probeHasRenderableContent(overflowStatusProbe);
		};

		queueMicrotask(measure);

		const observers: MutationObserver[] = [];
		for (const [enabled, node] of [
			[showOverflowIdentity, overflowIdentityProbe],
			[showOverflowActions, overflowActionsProbe],
			[showOverflowStatus, overflowStatusProbe],
		] as const) {
			if (!enabled || !node) {
				continue;
			}
			const observer = new MutationObserver(measure);
			observer.observe(node, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
			});
			observers.push(observer);
		}

		return () => {
			for (const observer of observers) {
				observer.disconnect();
			}
		};
	});
</script>

<div
	bind:this={rootRef}
	class={cn('workbench-toolbar__structured', className)}
	data-workbench-toolbar-layout="structured"
	data-workbench-toolbar-anchor={inlineState.anchorKind}
	data-workbench-toolbar-collapse-stage={inlineState.collapseStage}
>
	<div class="workbench-toolbar__structured-grid">
		<div
			class="workbench-toolbar__structured-left"
			data-has-page-tabs={hasPageTabs ? 'true' : 'false'}
			data-has-leading={identityLeading ? 'true' : 'false'}
			data-has-identity={showInlineIdentity ? 'true' : 'false'}
		>
			{#if hasPageTabs && pageTabs}
				<div class="workbench-toolbar__page-tabs" data-workbench-toolbar-region="page-tabs">
					{@render pageTabs(inlineState)}
				</div>
			{/if}

			{#if showInlineIdentity}
				{#if identityLeading}
					<div class="workbench-toolbar__identity-leading" data-workbench-toolbar-region="identity-leading">
						{@render identityLeading(inlineState)}
					</div>
				{/if}

				{#if hasIdentityBody}
					<div
						class="workbench-toolbar__identity-copy"
						data-has-subtitle={showInlineSubtitle ? 'true' : 'false'}
						data-has-status={showInlineStatusInIdentity ? 'true' : 'false'}
						data-workbench-toolbar-region="identity-inline"
					>
						{#if identityTitle || showInlineStatusInIdentity}
							<div class="workbench-toolbar__identity-title-row" data-workbench-toolbar-region="identity-title-row">
								{#if identityTitle}
									<div class="workbench-toolbar__identity-title" data-workbench-toolbar-region="identity-title">
										{@render identityTitle(inlineState)}
									</div>
								{/if}
								{#if showInlineStatusInIdentity && status}
									<div
										class="workbench-toolbar__status workbench-toolbar__status--inline-end"
										data-workbench-toolbar-region="status-inline"
									>
										{@render status(inlineState)}
									</div>
								{/if}
							</div>
						{/if}
						{#if showInlineSubtitle && identitySubtitle}
							<div
								class="workbench-toolbar__identity-subtitle"
								data-workbench-toolbar-region="identity-subtitle"
							>
								{@render identitySubtitle(inlineState)}
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>

		<div class="workbench-toolbar__structured-right" data-has-overflow={hasOverflowContent ? 'true' : 'false'}>
			{#if showInlineActions && actions}
				<div class="workbench-toolbar__actions" data-workbench-toolbar-region="actions-inline">
					{@render actions(inlineState)}
				</div>
			{/if}

			{#if showInlineStatusInRight && status}
				<div class="workbench-toolbar__status" data-workbench-toolbar-region="status-inline">
					{@render status(inlineState)}
				</div>
			{/if}

			{#if hasOverflowContent}
				<div class="workbench-toolbar__overflow-trigger" data-workbench-toolbar-region="overflow-trigger">
					<Button
						variant={overflowOpen ? 'secondary' : 'ghost'}
						size="icon-sm"
						class="rounded-full"
						type="button"
						aria-controls={overflowPanelId}
						aria-expanded={overflowOpen}
						aria-label={overflowLabel}
						title={overflowLabel}
						onclick={() => {
							overflowOpen = !overflowOpen;
						}}
					>
						<CircleEllipsisIcon class="size-4" />
					</Button>
				</div>
			{/if}
		</div>
	</div>

	{#if overflowOpen && hasOverflowContent}
		<div class="workbench-toolbar__overflow-shell">
			<div
				id={overflowPanelId}
				role="dialog"
				aria-modal="false"
				class="workbench-toolbar__overflow-panel"
				data-workbench-toolbar-region="overflow-panel"
			>
				<ScrollView
					class="workbench-toolbar__overflow-scroll"
					contentClass="workbench-toolbar__overflow-content scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)]"
					viewportClass="workbench-toolbar__overflow-viewport"
				>
					{#if showOverflowIdentity}
						<section class="workbench-toolbar__overflow-section" data-workbench-toolbar-region="overflow-identity">
							<div class="workbench-toolbar__overflow-identity-layout" data-has-leading={identityLeading ? 'true' : 'false'}>
								{#if identityLeading}
									<div class="workbench-toolbar__identity-leading" data-workbench-toolbar-region="overflow-identity-leading">
										{@render identityLeading(overflowState)}
									</div>
								{/if}
								<div class="workbench-toolbar__identity-copy" data-has-subtitle={identitySubtitle ? 'true' : 'false'}>
									{#if identityTitle}
										<div class="workbench-toolbar__identity-title" data-workbench-toolbar-region="overflow-identity-title">
											{@render identityTitle(overflowState)}
										</div>
									{/if}
									{#if identitySubtitle}
										<div class="workbench-toolbar__identity-subtitle" data-workbench-toolbar-region="overflow-identity-subtitle">
											{@render identitySubtitle(overflowState)}
										</div>
									{/if}
								</div>
							</div>
						</section>
					{/if}

					{#if showOverflowActions && actions}
						<section class="workbench-toolbar__overflow-section" data-workbench-toolbar-region="overflow-actions">
							{@render actions(overflowState)}
						</section>
					{/if}

					{#if showOverflowStatus && status}
						<section class="workbench-toolbar__overflow-section" data-workbench-toolbar-region="overflow-status">
							{@render status(overflowState)}
						</section>
					{/if}
				</ScrollView>
			</div>
		</div>
	{/if}
</div>

{#if hasOverflowCandidate}
	<div class="workbench-toolbar__overflow-measure" aria-hidden="true" hidden>
		{#if showOverflowIdentity}
			<div bind:this={overflowIdentityProbe}>
				<section class="workbench-toolbar__overflow-section">
					<div class="workbench-toolbar__overflow-identity-layout" data-has-leading={identityLeading ? 'true' : 'false'}>
						{#if identityLeading}
							<div class="workbench-toolbar__identity-leading">
								{@render identityLeading(overflowState)}
							</div>
						{/if}
						<div class="workbench-toolbar__identity-copy" data-has-subtitle={identitySubtitle ? 'true' : 'false'}>
							{#if identityTitle}
								<div class="workbench-toolbar__identity-title">
									{@render identityTitle(overflowState)}
								</div>
							{/if}
							{#if identitySubtitle}
								<div class="workbench-toolbar__identity-subtitle">
									{@render identitySubtitle(overflowState)}
								</div>
							{/if}
						</div>
					</div>
				</section>
			</div>
		{/if}

		{#if showOverflowActions && actions}
			<div bind:this={overflowActionsProbe}>
				<section class="workbench-toolbar__overflow-section">
					{@render actions(overflowState)}
				</section>
			</div>
		{/if}

		{#if showOverflowStatus && status}
			<div bind:this={overflowStatusProbe}>
				<section class="workbench-toolbar__overflow-section">
					{@render status(overflowState)}
				</section>
			</div>
		{/if}
	</div>
{/if}

<style>
	.workbench-toolbar__structured,
	.workbench-toolbar__structured-grid,
	.workbench-toolbar__structured-left,
	.workbench-toolbar__structured-right,
	.workbench-toolbar__page-tabs,
	.workbench-toolbar__identity-leading,
	.workbench-toolbar__identity-copy,
	.workbench-toolbar__actions,
	.workbench-toolbar__status {
		min-block-size: 0;
		min-inline-size: 0;
	}

	.workbench-toolbar__structured {
		block-size: 100%;
		position: relative;
	}

	.workbench-toolbar__structured-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
		block-size: 100%;
		padding-inline: 0.75rem;
	}

	.workbench-toolbar__structured-left {
		display: grid;
		align-items: center;
		gap: 0.08rem 0.55rem;
	}

	.workbench-toolbar__structured-left[data-has-page-tabs='true'][data-has-identity='true'] {
		grid-template-columns: minmax(0, auto) auto minmax(0, 1fr);
		grid-template-rows: repeat(2, minmax(0, 1fr));
	}

	.workbench-toolbar__structured-left[data-has-page-tabs='true'][data-has-identity='false'] {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: repeat(2, minmax(0, 1fr));
	}

	.workbench-toolbar__structured-left[data-has-page-tabs='false'][data-has-leading='true'] {
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: repeat(2, minmax(0, 1fr));
	}

	.workbench-toolbar__structured-left[data-has-page-tabs='false'][data-has-leading='false'] {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: repeat(2, minmax(0, 1fr));
	}

	.workbench-toolbar__page-tabs {
		grid-column: 1;
		grid-row: 1 / span 2;
		display: flex;
		align-items: center;
		overflow: visible;
	}

	.workbench-toolbar__identity-leading {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.workbench-toolbar__structured-left[data-has-page-tabs='true'] .workbench-toolbar__identity-leading {
		grid-column: 2;
		grid-row: 1 / span 2;
	}

	.workbench-toolbar__structured-left[data-has-page-tabs='true'] .workbench-toolbar__identity-copy {
		grid-column: 3;
		grid-row: 1 / span 2;
	}

	.workbench-toolbar__structured-left[data-has-page-tabs='false'][data-has-leading='true'] .workbench-toolbar__identity-leading {
		grid-column: 1;
		grid-row: 1 / span 2;
	}

	.workbench-toolbar__structured-left[data-has-page-tabs='false'][data-has-leading='true'] .workbench-toolbar__identity-copy {
		grid-column: 2;
		grid-row: 1 / span 2;
	}

	.workbench-toolbar__structured-left[data-has-page-tabs='false'][data-has-leading='false'] .workbench-toolbar__identity-copy {
		grid-column: 1;
		grid-row: 1 / span 2;
	}

	.workbench-toolbar__identity-copy {
		display: grid;
		align-content: center;
		gap: 0.08rem;
	}

	.workbench-toolbar__identity-title-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.42rem;
		min-inline-size: 0;
	}

	.workbench-toolbar__identity-title,
	.workbench-toolbar__identity-subtitle {
		min-inline-size: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.workbench-toolbar__identity-title {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1.05;
	}

	.workbench-toolbar__identity-subtitle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--muted-foreground);
		font-size: 0.68rem;
		line-height: 1.1;
	}

	.workbench-toolbar__structured-right {
		display: grid;
		grid-template-columns: minmax(0, max-content) auto;
		align-items: center;
		justify-items: end;
		gap: 0.42rem;
	}

	.workbench-toolbar__actions,
	.workbench-toolbar__status {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		line-height: 1;
	}

	.workbench-toolbar__actions {
		grid-column: 1;
		grid-row: 1;
	}

	.workbench-toolbar__status {
		grid-column: 1;
		grid-row: 1;
		font-variant-numeric: tabular-nums;
	}

	.workbench-toolbar__status--inline-end {
		grid-column: 2;
		grid-row: 1;
		min-inline-size: 0;
		justify-content: flex-end;
		justify-self: end;
		white-space: nowrap;
	}

	.workbench-toolbar__overflow-trigger {
		grid-column: 2;
		grid-row: 1;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.workbench-toolbar__overflow-shell {
		position: absolute;
		inset-block-start: calc(100% - 1px);
		inset-inline-end: 0.55rem;
		z-index: 25;
		padding-block-start: 0.35rem;
	}

	.workbench-toolbar__overflow-measure {
		position: absolute;
		inset: 0;
		visibility: hidden;
		pointer-events: none;
		overflow: hidden;
		block-size: 0;
		inline-size: 0;
	}

	.workbench-toolbar__overflow-panel {
		inline-size: min(28rem, calc(100cqi - 1.1rem));
		max-inline-size: calc(100vw - 1.25rem);
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--border), transparent 16%);
		border-radius: 1rem;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--card), white 10%) 0%,
				color-mix(in srgb, var(--card), var(--background) 78%) 100%
			);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--background), white 72%),
			0 22px 44px -26px color-mix(in srgb, var(--foreground), transparent 32%);
	}

	:global(.workbench-toolbar__overflow-scroll) {
		max-block-size: min(24rem, 60vh);
	}

	:global(.workbench-toolbar__overflow-content) {
		display: grid;
		gap: 0.8rem;
		padding: 0.8rem;
	}

	:global(.workbench-toolbar__overflow-content > * + *) {
		border-top: 1px solid color-mix(in srgb, var(--border), transparent 22%);
		padding-block-start: 0.8rem;
	}

	.workbench-toolbar__overflow-section {
		display: grid;
		justify-items: start;
		align-content: start;
		gap: 0.65rem;
		min-inline-size: 0;
	}

	.workbench-toolbar__overflow-identity-layout {
		display: grid;
		gap: 0.35rem 0.65rem;
	}

	.workbench-toolbar__overflow-identity-layout[data-has-leading='true'] {
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: repeat(2, auto);
	}

	.workbench-toolbar__overflow-identity-layout[data-has-leading='true'] .workbench-toolbar__identity-leading {
		grid-row: 1 / span 2;
	}

	.workbench-toolbar__overflow-identity-layout[data-has-leading='false'] {
		grid-template-columns: minmax(0, 1fr);
	}

	@container (max-width: 44rem) {
		.workbench-toolbar__structured-grid {
			gap: 0.45rem;
			padding-inline: 0.55rem;
		}

		.workbench-toolbar__structured-left {
			gap: 0.05rem 0.4rem;
		}

		.workbench-toolbar__identity-title {
			font-size: 0.78rem;
		}

		.workbench-toolbar__identity-subtitle {
			font-size: 0.64rem;
		}

		.workbench-toolbar__overflow-shell {
			inset-inline-end: 0.4rem;
		}

		.workbench-toolbar__overflow-panel {
			inline-size: min(24rem, calc(100cqi - 0.8rem));
		}
	}
</style>
