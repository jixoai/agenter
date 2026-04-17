<script lang="ts">
	import type {
		CachedResourceState,
		HeartbeatGroupItem,
		ModelCallItem,
		RuntimeAttentionState,
		RuntimeSchedulerState,
		SessionEntry,
	} from '@agenter/client-sdk';
	import {
		BOTTOM_ANCHORED_INSERT_MOTION_CLEAR_DELAY_MS,
		type BottomAnchoredTimelineHandle,
	} from '@agenter/svelte-components';
	import { tick, onDestroy } from 'svelte';

	import { Loader } from '$lib/components/ai-elements/loader/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		ConversationEmptyState,
		VirtualConversation,
	} from '$lib/components/ai-elements/conversation/index.js';

	import type {
		RuntimeHeartbeatConfigBinding,
		RuntimeHeartbeatConfigDraft,
	} from './runtime-heartbeat-config-state';
	import RuntimeHeartbeatStatusbar from './runtime-heartbeat-statusbar.svelte';
	import {
		buildHeartbeatAttentionFocusSummary,
		buildHeartbeatContextState,
		buildHeartbeatStatusState,
	} from './runtime-heartbeat-statusbar-state';
	import { buildHeartbeatDisplayGroups, estimateHeartbeatGroupSize } from './runtime-heartbeat-parts';
	import RuntimeHeartbeatGroup from './runtime-heartbeat-group.svelte';

	let {
		sessionStatus,
		schedulerState = null,
		groupsState,
		modelCalls = [],
		attention = null,
		compactPending = false,
		compactDisabled = false,
		onRequestCompact,
		onLoadOlder,
		configBinding,
		configLoading = false,
		configSaving = false,
		configError = null,
		onRefreshConfig,
		onSaveConfig,
		sessionIconUrl = null,
		avatarLabel = 'Avatar',
	}: {
		sessionStatus: SessionEntry['status'];
		schedulerState?: RuntimeSchedulerState | null;
		groupsState: CachedResourceState<HeartbeatGroupItem[]>;
		modelCalls?: ModelCallItem[];
		attention?: RuntimeAttentionState | null;
		compactPending?: boolean;
		compactDisabled?: boolean;
		onRequestCompact: () => void | Promise<void>;
		onLoadOlder: () => Promise<{ items: number; hasMore: boolean }>;
		configBinding: RuntimeHeartbeatConfigBinding;
		configLoading?: boolean;
		configSaving?: boolean;
		configError?: string | null;
		onRefreshConfig: () => void | Promise<void>;
		onSaveConfig: (draft: RuntimeHeartbeatConfigDraft) => boolean | Promise<boolean>;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	let loadingOlder = $state(false);
	let hasMoreOlder = $state(true);
	let viewportAtTop = $state(false);
	let viewportRef = $state<HTMLDivElement | null>(null);
	let timelineRef = $state<BottomAnchoredTimelineHandle | null>(null);
	let insertMotionByGroupId = $state<Record<string, 'latest' | 'older'>>({});
	let insertMotionClearHandle = 0;
	let previousGroupIds: string[] = [];

	const groups = $derived(buildHeartbeatDisplayGroups(groupsState.data));
	const configuredContextLimit = $derived(configBinding.draft.maxToken ?? configBinding.providerMetadata?.maxContextTokens ?? null);
	const contextState = $derived(buildHeartbeatContextState(modelCalls, configuredContextLimit));
	const shimmerSummary = $derived(buildHeartbeatAttentionFocusSummary(attention));
	const statusState = $derived(
		buildHeartbeatStatusState({
			sessionStatus,
			schedulerState,
			heartbeatGroups: groupsState,
		}),
	);
	const showTopLoadAffordance = $derived(groupsState.loaded && groups.length > 0 && viewportAtTop);
	const groupCount = $derived(groups.length);
	const groupCountVisible = $derived(groupsState.loaded);
	const secondaryStatus = $derived.by(() => {
		if (groupsState.refreshing) {
			return 'Refreshing persisted Heartbeat…';
		}
		if (groupsState.loaded && groupsState.error) {
			return groupsState.error;
		}
		return null;
	});
	const emptyState = $derived.by(() => {
		if (groupsState.error && !groupsState.loaded) {
			return {
				title: 'Heartbeat failed to load',
				description: groupsState.error,
			};
		}
		if (!groupsState.loaded) {
			return {
				title: 'Loading Heartbeat…',
				description: 'Replaying persisted prompt facts, attention inputs, and assistant output.',
			};
		}
		return {
			title: 'No Heartbeat rows yet',
			description: 'Persisted Heartbeat message-parts will appear here as soon as the runtime records prompt facts, attention inputs, or assistant output.',
		};
	});

	const clearInsertMotion = (groupIds?: string[]): void => {
		if (!groupIds || groupIds.length === 0) {
			insertMotionByGroupId = {};
			return;
		}
		const nextState = { ...insertMotionByGroupId };
		for (const groupId of groupIds) {
			delete nextState[groupId];
		}
		insertMotionByGroupId = nextState;
	};

	const scheduleInsertMotionClear = (groupIds: string[]): void => {
		if (typeof window === 'undefined' || groupIds.length === 0) {
			return;
		}
		if (insertMotionClearHandle !== 0) {
			window.clearTimeout(insertMotionClearHandle);
		}
		insertMotionClearHandle = window.setTimeout(() => {
			insertMotionClearHandle = 0;
			clearInsertMotion(groupIds);
		}, BOTTOM_ANCHORED_INSERT_MOTION_CLEAR_DELAY_MS);
	};

	const markInsertedGroups = (groupIds: string[], motion: 'latest' | 'older'): void => {
		if (groupIds.length === 0) {
			return;
		}
		insertMotionByGroupId = {
			...insertMotionByGroupId,
			...Object.fromEntries(groupIds.map((groupId) => [groupId, motion])),
		};
		scheduleInsertMotionClear(groupIds);
	};

	const waitForTimelineSettle = async (): Promise<void> => {
		await tick();
		if (typeof window === 'undefined' || !viewportRef) {
			return;
		}
		let stableFrames = 0;
		let lastSignature = '';
		for (let index = 0; index < 12; index += 1) {
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => {
					resolve();
				});
			});
			const currentViewport = viewportRef;
			if (!currentViewport) {
				return;
			}
			const nextSignature = `${currentViewport.scrollTop}:${currentViewport.scrollHeight}`;
			if (nextSignature === lastSignature) {
				stableFrames += 1;
				if (stableFrames >= 2) {
					return;
				}
				continue;
			}
			lastSignature = nextSignature;
			stableFrames = 0;
		}
	};

	const waitForGroupCount = async (minimumCount: number): Promise<void> => {
		if (groups.length >= minimumCount) {
			return;
		}
		for (let index = 0; index < 12; index += 1) {
			await tick();
			if (groups.length >= minimumCount) {
				return;
			}
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => {
					resolve();
				});
			});
			if (groups.length >= minimumCount) {
				return;
			}
		}
	};

	const loadOlder = async (): Promise<void> => {
		if (loadingOlder || !hasMoreOlder) {
			return;
		}
		const preLoadGroupCount = groups.length;
		loadingOlder = true;
		try {
			const result = await onLoadOlder();
			hasMoreOlder = result.hasMore;
			if (result.items > 0) {
				await waitForGroupCount(preLoadGroupCount + result.items);
				await waitForTimelineSettle();
			}
		} finally {
			loadingOlder = false;
		}
	};

	$effect(() => {
		const currentGroupIds = groups.map((group) => group.groupId);
		const previousSet = new Set(previousGroupIds);
		const currentSet = new Set(currentGroupIds);
		const hasOverlap = previousGroupIds.some((groupId) => currentSet.has(groupId));
		const newGroupIds = currentGroupIds.filter((groupId) => !previousSet.has(groupId));
		previousGroupIds = currentGroupIds;
		if (currentGroupIds.length === 0 || previousSet.size === 0 || !hasOverlap || newGroupIds.length === 0) {
			if (!hasOverlap) {
				clearInsertMotion();
			}
			return;
		}

		let firstExistingIndex = -1;
		let lastExistingIndex = -1;
		for (const [index, groupId] of currentGroupIds.entries()) {
			if (!previousSet.has(groupId)) {
				continue;
			}
			if (firstExistingIndex === -1) {
				firstExistingIndex = index;
			}
			lastExistingIndex = index;
		}
		if (firstExistingIndex === -1 || lastExistingIndex === -1) {
			return;
		}

		const olderGroupIds: string[] = [];
		const latestGroupIds: string[] = [];
		for (const groupId of newGroupIds) {
			const index = currentGroupIds.indexOf(groupId);
			if (index < firstExistingIndex) {
				olderGroupIds.push(groupId);
				continue;
			}
			if (index > lastExistingIndex) {
				latestGroupIds.push(groupId);
			}
		}
		markInsertedGroups(olderGroupIds, 'older');
		markInsertedGroups(latestGroupIds, 'latest');
	});

	onDestroy(() => {
		if (typeof window !== 'undefined' && insertMotionClearHandle !== 0) {
			window.clearTimeout(insertMotionClearHandle);
		}
	});
</script>

<div
	class="runtime-heartbeat-stage relative grid h-full min-w-0 grid-rows-[minmax(0,1fr)_auto] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_6%)_0%,var(--card)_18%,color-mix(in_srgb,var(--background),var(--card)_42%)_100%)]"
	data-testid="runtime-heartbeat-stage"
>
	{#if secondaryStatus}
		<div class="absolute inset-x-0 top-3 z-10 flex justify-center px-3">
			<div class="rounded-full border border-border/60 bg-background/88 px-3 py-1 text-xs text-muted-foreground shadow-sm">
				{secondaryStatus}
			</div>
		</div>
	{/if}

	<VirtualConversation
		class="h-full min-w-0"
		contentClass="px-3"
		viewportTestId="runtime-heartbeat-viewport"
		bind:atTop={viewportAtTop}
		bind:viewportRef
		bind:timelineRef
		items={groups}
		virtual={{
			estimateSize: (_, group) => estimateHeartbeatGroupSize(group),
			getItemKey: (_, group) => group.groupId,
			measureElement: true,
			overscan: 4,
			gap: 12,
			paddingStart: 12,
			paddingEnd: 12,
		}}
		>
		{#snippet renderBefore()}
			{#if showTopLoadAffordance}
				<div class="flex justify-center px-3 pb-2 pt-12">
					{#if hasMoreOlder}
						<Button
							variant="outline"
							size="sm"
							class="rounded-full bg-background/88 shadow-sm"
							disabled={loadingOlder}
							onclick={() => void loadOlder()}
						>
							{#if loadingOlder}
								<Loader label="Loading older" />
							{:else}
								Load older
							{/if}
						</Button>
					{:else}
						<div class="rounded-full border border-border/60 bg-background/88 px-3 py-1 text-xs text-muted-foreground shadow-sm">
							No older messages
						</div>
					{/if}
				</div>
			{/if}
		{/snippet}

		{#snippet renderItem(group)}
			<div data-insert-motion={insertMotionByGroupId[group.groupId] ?? 'none'}>
				<RuntimeHeartbeatGroup {group} {sessionIconUrl} {avatarLabel} />
			</div>
		{/snippet}

		{#snippet renderEmpty()}
			<ConversationEmptyState
				class="px-6 py-12"
				data-testid="runtime-heartbeat-empty"
				title={emptyState.title}
				description={emptyState.description}
			/>
		{/snippet}
	</VirtualConversation>

	<RuntimeHeartbeatStatusbar
		{statusState}
		{contextState}
		{shimmerSummary}
		{groupCount}
		{groupCountVisible}
		{compactPending}
		{compactDisabled}
		{configBinding}
		{configLoading}
		{configSaving}
		{configError}
		{onRequestCompact}
		onRefreshConfig={onRefreshConfig}
		onSaveConfig={onSaveConfig}
	/>
</div>

<style>
	.runtime-heartbeat-stage {
		min-block-size: 0;
	}
</style>
