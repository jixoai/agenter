<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import { Tabs as TabsPrimitive } from 'bits-ui';

	import { cn } from '$lib/utils.js';

	import type { WorkbenchPageTabItem } from './workbench-page-tabs.types';
	import type { WorkbenchToolbarRenderState } from './workbench-toolbar.types';

	let {
		value,
		items,
		toolbarState,
		ariaLabel = 'Page tabs',
		class: className,
		onValueChange,
	}: {
		value: string;
		items: WorkbenchPageTabItem[];
		toolbarState: WorkbenchToolbarRenderState;
		ariaLabel?: string;
		class?: string;
		onValueChange?: (value: string) => void | Promise<void>;
	} = $props();

	let trackedTabElements = $state<Record<string, HTMLButtonElement>>({});

	const handleValueChange = (nextValue: string): void => {
		if (nextValue === value) {
			return;
		}
		void onValueChange?.(nextValue);
	};

	const trackTabElement = (element: HTMLButtonElement, tabValue: string) => {
		trackedTabElements = {
			...trackedTabElements,
			[tabValue]: element,
		};
		return {
			destroy: () => {
				const { [tabValue]: _removed, ...rest } = trackedTabElements;
				trackedTabElements = rest;
			},
		};
	};

	$effect(() => {
		trackedTabElements[value]?.scrollIntoView({
			block: 'nearest',
			inline: 'nearest',
		});
	});
</script>

<TabsPrimitive.Root value={value} onValueChange={handleValueChange}>
	<nav
		aria-label={ariaLabel}
		class={cn('workbench-page-tabs', className)}
		data-workbench-page-tabs
		data-workbench-page-tabs-breakpoint={toolbarState.breakpoint}
		data-workbench-page-tabs-density={toolbarState.density}
	>
		<ScrollView
			class="workbench-page-tabs__scroll"
			orientation="horizontal"
			viewportClass="workbench-page-tabs__viewport"
			contentClass="workbench-page-tabs__content"
		>
			<TabsPrimitive.List class="workbench-page-tabs__list">
				{#each items as item (item.value)}
					<TabsPrimitive.Trigger value={item.value}>
						{#snippet child({ props })}
							<button
								{...props}
								use:trackTabElement={item.value}
								type="button"
								class="workbench-page-tabs__trigger"
								data-workbench-page-tab={item.value}
								data-has-badge={item.badgeLabel ? 'true' : 'false'}
								title={item.title ?? item.label}
							>
								<span class="workbench-page-tabs__label">{item.label}</span>
								{#if item.badgeLabel}
									<span
										class="workbench-page-tabs__badge"
										data-tone={item.badgeTone ?? 'neutral'}
										data-animated={item.badgeAnimated ? 'true' : 'false'}
									>
										{item.badgeLabel}
									</span>
								{/if}
							</button>
						{/snippet}
					</TabsPrimitive.Trigger>
				{/each}
			</TabsPrimitive.List>
		</ScrollView>
	</nav>
</TabsPrimitive.Root>

<style>
	.workbench-page-tabs {
		--workbench-page-tabs-list-block-size: 1.875rem;
		--workbench-page-tabs-list-padding: 0.1875rem;
		--workbench-page-tabs-trigger-gap: 0.375rem;
		--workbench-page-tabs-trigger-padding-inline-start: 0.72rem;
		--workbench-page-tabs-trigger-padding-inline-end: 0.72rem;
		--workbench-page-tabs-trigger-padding-inline-end-with-badge: 0.46rem;
		--workbench-page-tabs-trigger-font-size: 0.72rem;
		--workbench-page-tabs-badge-block-size: 1rem;
		--workbench-page-tabs-badge-min-inline-size: 1rem;
		--workbench-page-tabs-badge-padding-inline: 0.32rem;
		--workbench-page-tabs-badge-font-size: 0.56rem;
		display: flex;
		align-items: center;
		block-size: 100%;
		inline-size: 100%;
		min-inline-size: 0;
		overflow: visible;
	}

	.workbench-page-tabs[data-workbench-page-tabs-breakpoint='compact'] {
		--workbench-page-tabs-list-block-size: 1.8125rem;
		--workbench-page-tabs-trigger-padding-inline-start: 0.66rem;
		--workbench-page-tabs-trigger-padding-inline-end: 0.66rem;
		--workbench-page-tabs-trigger-padding-inline-end-with-badge: 0.4rem;
		--workbench-page-tabs-trigger-font-size: 0.7rem;
	}

	.workbench-page-tabs[data-workbench-page-tabs-breakpoint='narrow'] {
		--workbench-page-tabs-list-block-size: 1.6875rem;
		--workbench-page-tabs-list-padding: 0.15625rem;
		--workbench-page-tabs-trigger-gap: 0.3rem;
		--workbench-page-tabs-trigger-padding-inline-start: 0.56rem;
		--workbench-page-tabs-trigger-padding-inline-end: 0.56rem;
		--workbench-page-tabs-trigger-padding-inline-end-with-badge: 0.32rem;
		--workbench-page-tabs-trigger-font-size: 0.66rem;
		--workbench-page-tabs-badge-block-size: 0.9rem;
		--workbench-page-tabs-badge-min-inline-size: 0.9rem;
		--workbench-page-tabs-badge-padding-inline: 0.28rem;
		--workbench-page-tabs-badge-font-size: 0.52rem;
	}

	:global(.workbench-page-tabs__scroll) {
		inline-size: 100%;
		min-inline-size: 0;
		overflow: visible;
		touch-action: pan-x;
	}

	:global(.workbench-page-tabs__viewport) {
		margin-block: -0.25rem;
		padding-block: 0.25rem;
		overflow-y: visible !important;
		scrollbar-width: none;
	}

	:global(.workbench-page-tabs__viewport::-webkit-scrollbar) {
		display: none;
	}

	:global(.workbench-page-tabs__content) {
		min-inline-size: max-content;
	}

	:global(.workbench-page-tabs__list) {
		display: inline-flex;
		align-items: stretch;
		gap: 0.125rem;
		block-size: var(--workbench-page-tabs-list-block-size);
		min-inline-size: 100%;
		padding: var(--workbench-page-tabs-list-padding);
		border: 1px solid color-mix(in srgb, var(--border), transparent 18%);
		border-radius: 999px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--background), white 16%) 0%,
				color-mix(in srgb, var(--background), transparent 4%) 100%
			);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--background), white 70%),
			0 1px 2px -1px color-mix(in srgb, var(--foreground), transparent 20%);
	}

	.workbench-page-tabs__trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--workbench-page-tabs-trigger-gap);
		block-size: 100%;
		min-inline-size: max-content;
		padding-inline-start: var(--workbench-page-tabs-trigger-padding-inline-start);
		padding-inline-end: var(--workbench-page-tabs-trigger-padding-inline-end);
		border: 1px solid transparent;
		border-radius: calc(999px - var(--workbench-page-tabs-list-padding));
		background: transparent;
		color: color-mix(in srgb, var(--muted-foreground), var(--foreground) 14%);
		font-family: var(--font-nav, var(--font-sans));
		font-size: var(--workbench-page-tabs-trigger-font-size);
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
		box-shadow: none;
		outline: none;
		transition:
			color 160ms ease,
			background-color 160ms ease,
			border-color 160ms ease,
			box-shadow 160ms ease;
	}

	.workbench-page-tabs__trigger[data-has-badge='true'] {
		padding-inline-end: var(--workbench-page-tabs-trigger-padding-inline-end-with-badge);
	}

	.workbench-page-tabs__trigger:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--muted), transparent 14%);
	}

	.workbench-page-tabs__trigger:focus-visible {
		border-color: color-mix(in srgb, var(--ring), transparent 45%);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring), transparent 82%);
	}

	.workbench-page-tabs__trigger[data-state='active'] {
		border-color: color-mix(in srgb, var(--border), transparent 8%);
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--background), white 34%) 0%,
				color-mix(in srgb, var(--background), white 12%) 100%
			);
		color: var(--foreground);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--background), white 78%),
			0 1px 2px -1px color-mix(in srgb, var(--foreground), transparent 18%);
	}

	.workbench-page-tabs__label {
		display: block;
	}

	.workbench-page-tabs__badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		align-self: center;
		block-size: var(--workbench-page-tabs-badge-block-size);
		min-inline-size: var(--workbench-page-tabs-badge-min-inline-size);
		padding-inline: var(--workbench-page-tabs-badge-padding-inline);
		border: 1px solid transparent;
		border-radius: 999px;
		font-family: var(--font-nav, var(--font-sans));
		font-size: var(--workbench-page-tabs-badge-font-size);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		letter-spacing: 0.02em;
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--background), white 20%);
	}

	.workbench-page-tabs__badge[data-animated='true'] {
		animation: workbench-page-tabs-badge-pulse 1.8s ease-in-out infinite;
	}

	.workbench-page-tabs__badge[data-tone='neutral'] {
		border-color: color-mix(in srgb, var(--border), transparent 26%);
		background: color-mix(in srgb, var(--background), var(--muted) 28%);
		color: var(--muted-foreground);
	}

	.workbench-page-tabs__badge[data-tone='accent'] {
		border-color: color-mix(in srgb, var(--border), transparent 20%);
		background: color-mix(in srgb, var(--muted), white 12%);
		color: var(--foreground);
	}

	.workbench-page-tabs__badge[data-tone='positive'] {
		background: color-mix(in srgb, var(--color-emerald-500), white 6%);
		color: white;
	}

	.workbench-page-tabs__badge[data-tone='warning'] {
		background: color-mix(in srgb, var(--color-amber-400), white 4%);
		color: var(--color-slate-900);
	}

	.workbench-page-tabs__badge[data-tone='critical'] {
		background: color-mix(in srgb, var(--color-rose-500), white 4%);
		color: white;
	}

	@keyframes workbench-page-tabs-badge-pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}

		50% {
			opacity: 0.82;
			transform: scale(0.96);
		}
	}
</style>
