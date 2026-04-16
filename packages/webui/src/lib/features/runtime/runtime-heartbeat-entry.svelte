<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Copy from '@lucide/svelte/icons/copy';
	import { onMount, tick } from 'svelte';

	import { Action, Actions } from '$lib/components/ai-elements/action/index.js';
	import { Checkpoint, CheckpointIcon } from '$lib/components/ai-elements/checkpoint/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Item as ToggleGroupItem, Root as ToggleGroupRoot } from '$lib/components/ui/toggle-group/index.js';

	import RuntimeHeartbeatPartContent from './runtime-heartbeat-part-content.svelte';
	import RuntimeHeartbeatToolBlock from './runtime-heartbeat-tool-block.svelte';
	import {
		buildHeartbeatSectionClipboardText,
		getHeartbeatSectionTimeMeta,
		getHeartbeatRowPreview,
		readHeartbeatPartText,
		type HeartbeatSubjectSection,
	} from './runtime-heartbeat-parts';
	import {
		formatRuntimeCompactDuration,
		formatRuntimeCompactTimestamp,
	} from './runtime-shell-format';

	type HeartbeatLayoutMode = 'compact' | 'detailed';
	const HEARTBEAT_ENTRY_MAX_CONTENT_HEIGHT_REM = 28;
	const HEARTBEAT_ENTRY_MAX_CONTENT_HEIGHT = `${HEARTBEAT_ENTRY_MAX_CONTENT_HEIGHT_REM}rem`;

	let {
		section,
		layoutMode = 'compact',
		groupLabel,
		groupTimestamp,
		onLayoutModeChange = undefined,
	}: {
		section: HeartbeatSubjectSection;
		layoutMode?: HeartbeatLayoutMode;
		groupLabel: string;
		groupTimestamp: number;
		onLayoutModeChange?: ((mode: HeartbeatLayoutMode) => void) | undefined;
	} = $props();

	const summary = $derived(section.entries[0] ? getHeartbeatRowPreview(section.entries[0]) : '');
	const compactCheckpointText = $derived.by(() => {
		const firstBlock = section.blocks[0]?.content;
		if (!firstBlock || section.blocks.length !== 1 || firstBlock.kind !== 'part' || firstBlock.part.partType !== 'compact') {
			return null;
		}
		return readHeartbeatPartText(firstBlock.part)?.trim() ?? summary;
	});
	const hasRunningEntries = $derived(section.entries.some((entry) => !entry.isComplete));
	let nowMs = $state(Date.now());
	const timeMeta = $derived(getHeartbeatSectionTimeMeta(section, nowMs));
	const headerTimeLabel = $derived.by(() => {
		const startedAt = timeMeta.startedAt ?? groupTimestamp;
		const startedAtLabel = formatRuntimeCompactTimestamp(startedAt);
		if (!timeMeta.showRange) {
			return startedAtLabel;
		}
		return `${startedAtLabel}, ${formatRuntimeCompactDuration(timeMeta.durationMs)}`;
	});
	let localLayoutMode = $state<HeartbeatLayoutMode>('compact');
	let syncedLayoutMode = $state<HeartbeatLayoutMode>('compact');
	let contentViewport = $state<HTMLDivElement | null>(null);
	let isExpandable = $state(false);
	let isExpanded = $state(false);

	const copySection = async (): Promise<void> => {
		if (typeof navigator === 'undefined' || !navigator.clipboard) {
			return;
		}
		await navigator.clipboard.writeText(buildHeartbeatSectionClipboardText(section));
	};

	const recalculateExpandableState = (): void => {
		if (typeof window === 'undefined' || !contentViewport) {
			return;
		}
		const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize || '16');
		const collapsedMaxHeightPx = HEARTBEAT_ENTRY_MAX_CONTENT_HEIGHT_REM * rootFontSize;
		const nextExpandable = contentViewport.scrollHeight > collapsedMaxHeightPx + 1;
		isExpandable = nextExpandable;
		if (!nextExpandable) {
			isExpanded = false;
		}
	};

	$effect(() => {
		if (layoutMode === syncedLayoutMode) {
			return;
		}
		syncedLayoutMode = layoutMode;
		localLayoutMode = layoutMode;
	});

	$effect(() => {
		if (localLayoutMode === syncedLayoutMode) {
			return;
		}
		syncedLayoutMode = localLayoutMode;
		onLayoutModeChange?.(localLayoutMode);
	});

	$effect(() => {
		nowMs = Date.now();
		if (!hasRunningEntries) {
			return;
		}
		const interval = window.setInterval(() => {
			nowMs = Date.now();
		}, 1_000);
		return () => {
			window.clearInterval(interval);
		};
	});

	$effect(() => {
		section.key;
		section.blocks.length;
		localLayoutMode;
		void tick().then(() => {
			recalculateExpandableState();
		});
	});

	onMount(() => {
		recalculateExpandableState();
		if (!contentViewport || typeof ResizeObserver === 'undefined') {
			return;
		}
		const resizeObserver = new ResizeObserver(() => {
			recalculateExpandableState();
		});
		resizeObserver.observe(contentViewport);
		return () => {
			resizeObserver.disconnect();
		};
	});
</script>

<section
	class="grid w-full min-w-0 gap-2.5 rounded-[1.2rem] border border-border/55 bg-background/72 px-3 py-2.5 shadow-[0_14px_28px_-28px_color-mix(in_srgb,var(--foreground),transparent_18%)]"
	data-testid={`runtime-heartbeat-entry-${section.entryId}`}
	data-layout-mode={localLayoutMode}
>
	<header
		class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
		data-testid={`runtime-heartbeat-entry-header-${section.entryId}`}
	>
		<div class="flex min-w-0 flex-wrap items-center gap-1.5">
			<Badge variant="outline" class="rounded-full bg-background/70 px-2 py-0.5 text-[10px]">
				{groupLabel}
			</Badge>
		</div>
		<span
			class="text-[11px] leading-none text-muted-foreground"
			data-testid={`runtime-heartbeat-entry-time-${section.entryId}`}
			title={
				timeMeta.isRunning
					? `Running for ${formatRuntimeCompactDuration(timeMeta.durationMs)}`
					: timeMeta.endedAt
						? `Ended ${formatRuntimeCompactTimestamp(timeMeta.endedAt)}`
						: undefined
			}
		>
			{headerTimeLabel}
		</span>
	</header>

	<div class="relative min-w-0">
		<div
			bind:this={contentViewport}
			class="grid min-w-0 gap-2"
			data-overflow-state={isExpandable ? (isExpanded ? 'expanded' : 'collapsed') : 'fit'}
			style:max-height={isExpandable && !isExpanded ? HEARTBEAT_ENTRY_MAX_CONTENT_HEIGHT : undefined}
			style:overflow={isExpandable && !isExpanded ? 'hidden' : 'visible'}
			data-testid={`runtime-heartbeat-entry-body-${section.entryId}`}
		>
			{#if compactCheckpointText}
				<Checkpoint class="rounded-lg border border-dashed border-border/55 bg-muted/10 px-2.5 py-2">
					<CheckpointIcon />
					<div class="grid min-w-0 gap-0.5">
						<div class="text-[13px] leading-5 text-foreground">{compactCheckpointText}</div>
					</div>
				</Checkpoint>
			{:else}
				{#each section.blocks as block (block.key)}
					{#if block.content.kind === 'tool'}
						<RuntimeHeartbeatToolBlock
							block={block.content}
							forceOpen={localLayoutMode === 'detailed'}
							layoutMode={localLayoutMode}
						/>
					{:else}
						<RuntimeHeartbeatPartContent part={block.content.part} />
					{/if}
				{/each}
				{#if section.blocks.length === 0}
					<div class="text-[13px] leading-5 text-muted-foreground">{summary}</div>
				{/if}
			{/if}
		</div>
		{#if isExpandable && !isExpanded}
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-[1rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background),transparent_100%)_0%,color-mix(in_srgb,var(--background),transparent_28%)_38%,color-mix(in_srgb,var(--background),transparent_4%)_100%)]"
			></div>
		{/if}
	</div>

	<footer
		class="flex min-w-0 items-center justify-end gap-2 border-t border-border/25 pt-1.5"
		data-testid={`runtime-heartbeat-entry-meta-${section.entryId}`}
	>
		<div class="flex flex-wrap items-center justify-end gap-1">
			{#if isExpandable}
				<Button
					variant="outline"
					size="sm"
					class="h-7 rounded-full px-2.5 text-[11px] font-medium"
					onclick={() => {
						isExpanded = !isExpanded;
					}}
				>
					{#if isExpanded}
						<ChevronUp class="size-3.5" />
						Collapse
					{:else}
						<ChevronDown class="size-3.5" />
						Expand
					{/if}
				</Button>
			{/if}
			<ToggleGroupRoot
				ariaLabel="Heartbeat group layout"
				bind:value={localLayoutMode}
			>
				<ToggleGroupItem value="compact">
					Compact
				</ToggleGroupItem>
				<ToggleGroupItem value="detailed">
					Detailed
				</ToggleGroupItem>
			</ToggleGroupRoot>
			<Actions>
				<Action class="size-7" tooltip="Copy section" label="Copy section" onclick={() => void copySection()}>
					<Copy class="size-4" />
				</Action>
			</Actions>
		</div>
	</footer>
</section>
