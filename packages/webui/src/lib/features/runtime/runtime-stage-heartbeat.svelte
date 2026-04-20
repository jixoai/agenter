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
		createActionTrigger,
		createCollectionDeltaTrigger,
		createEdgeTrigger,
		createInsertBatchTrigger,
		createOverflowTrigger,
		createUserInputTrigger,
		defineScrollTriggerName,
		type ActionTriggerQuery,
		type AnchoredVirtualListScrollHandle,
		type CollectionDeltaTriggerQuery,
		type EdgeTriggerQuery,
		type InsertBatchTriggerQuery,
		type OverflowTriggerQuery,
		type ScrollController,
		type ScrollProgramController,
		type UserInputTriggerQuery,
		readScrollTriggerQuery,
	} from '@agenter/svelte-components';
	import { tick, onDestroy, untrack } from 'svelte';

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

	const edgeTriggerName = defineScrollTriggerName<EdgeTriggerQuery>('edge');
	const userInputTriggerName = defineScrollTriggerName<UserInputTriggerQuery>('userInput');
	const scrollToLatestTriggerName = defineScrollTriggerName<ActionTriggerQuery>('scrollToLatest');
	const groupDeltaTriggerName = defineScrollTriggerName<CollectionDeltaTriggerQuery>('groupDelta');
	const groupInsertLatestTriggerName = defineScrollTriggerName<InsertBatchTriggerQuery>('groupInsertLatest');
	const groupInsertOlderTriggerName = defineScrollTriggerName<InsertBatchTriggerQuery>('groupInsertOlder');
	const overflowTriggerName = defineScrollTriggerName<OverflowTriggerQuery>('overflow');
	const emptyEdgeQuery: EdgeTriggerQuery = {
		atLatest: true,
		atStart: true,
		enteredLatest: false,
		leftLatest: false,
		enteredStart: false,
		leftStart: false,
		distanceToLatestPx: 0,
		distanceToStartPx: 0,
	};
	const emptyUserInputQuery: UserInputTriggerQuery = {
		active: false,
		entered: false,
		exited: false,
		kind: 'idle',
		pointerType: null,
		momentum: false,
		startedAt: null,
		lastEventAt: null,
	};
	const emptyDeltaQuery: CollectionDeltaTriggerQuery = {
		changed: false,
		direction: 'unknown',
		insertedKeys: [],
		removedKeys: [],
		anchorKey: null,
	};
	const emptyInsertQuery = (motion: 'latest' | 'older'): InsertBatchTriggerQuery => ({
		changed: false,
		motion,
		elements: [],
		extentPx: 0,
		nearestElement: null,
	});
	const emptyOverflowQuery: OverflowTriggerQuery = {
		overflowing: false,
		becameOverflowing: false,
		becameContained: false,
		overflowPx: 0,
		visibleExtentPx: 0,
		contentExtentPx: 0,
	};

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
		viewportRef = $bindable<HTMLDivElement | null>(null),
		timelineRef = $bindable<AnchoredVirtualListScrollHandle | null>(null),
		scrollControllerRef = $bindable<ScrollController | null>(null),
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
		viewportRef?: HTMLDivElement | null;
		timelineRef?: AnchoredVirtualListScrollHandle | null;
		scrollControllerRef?: ScrollController | null;
	} = $props();

	let loadingOlder = $state(false);
	let hasMoreOlder = $state(true);
	let viewportAtTop = $state(false);
	let internalScrollControllerRef = $state<ScrollController | null>(null);
	let scrollToLatestButtonRef = $state<HTMLButtonElement | null>(null);
	let insertMotionByGroupId = $state<Record<string, 'latest' | 'older'>>({});
	let insertMotionClearHandle = 0;
	let initialLatestSyncPending = $state(false);
	let initialLatestSyncHandled = $state(false);
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
		if (!timelineRef) {
			return;
		}
		await timelineRef.awaitSettle();
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

	const escapeSelectorValue = (value: string): string =>
		typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
			? CSS.escape(value)
			: value.replace(/["\\]/gu, '\\$&');

	const resolveGroupSelector = (groupId: string): string =>
		`[data-testid="runtime-heartbeat-group-${escapeSelectorValue(groupId)}"]`;

	$effect(() => {
		const hasLoadedGroups = groupsState.loaded && groups.length > 0;
		const coldEmptyState = !groupsState.loaded && groups.length === 0;
		if (coldEmptyState) {
			initialLatestSyncPending = false;
			initialLatestSyncHandled = false;
			return;
		}
		if (hasLoadedGroups && !initialLatestSyncHandled) {
			initialLatestSyncPending = true;
		}
	});

	const runProgramTx = async (
		program: ScrollProgramController,
		effect: Parameters<ScrollProgramController['tx']>[0],
		options: Parameters<ScrollProgramController['tx']>[1],
	): Promise<void> => {
		const transaction = await program.tx(effect, options);
		void transaction.finished.catch(() => {
			/* interruption is an expected semantic outcome */
		});
	};

	$effect(() => {
		scrollControllerRef = internalScrollControllerRef;
	});

	$effect(() => {
		const controller = internalScrollControllerRef;
		const viewport = viewportRef;
		const latestButton = scrollToLatestButtonRef;
		if (!controller || !viewport || !latestButton) {
			return;
		}
		return untrack(() => {
			const observedDom = {
				viewport,
				content: viewport,
			} satisfies Parameters<ReturnType<typeof createEdgeTrigger>['observe']>[0];
			const disconnectEdge = createEdgeTrigger({
				latestThreshold: 48,
				startThreshold: 72,
			})
				.observe(observedDom)
				.connect(controller, { name: edgeTriggerName });
			const disconnectUserInput = createUserInputTrigger().observe(observedDom).connect(controller, {
				name: userInputTriggerName,
			});
			const disconnectScrollToLatest = createActionTrigger()
				.observe({ element: latestButton })
				.connect(controller, { name: scrollToLatestTriggerName });
			const disconnectGroupDelta = createCollectionDeltaTrigger({
				getKeys: () => groups.map((group) => group.groupId),
			})
				.observe(observedDom)
				.connect(controller, { name: groupDeltaTriggerName });
			const disconnectLatestInsert = createInsertBatchTrigger({
				motion: 'latest',
			})
				.observe(observedDom)
				.connect(controller, { name: groupInsertLatestTriggerName });
			const disconnectOlderInsert = createInsertBatchTrigger({
				motion: 'older',
			})
				.observe(observedDom)
				.connect(controller, { name: groupInsertOlderTriggerName });
			const disconnectOverflow = createOverflowTrigger().observe(observedDom).connect(controller, {
				name: overflowTriggerName,
			});
			let previousEdgeAtLatest = true;
			let previousEdgeAtStart = false;

			const uninstallProgram = controller.install((program) => {
				const edge = readScrollTriggerQuery(program.query, edgeTriggerName, emptyEdgeQuery);
				const userInput = readScrollTriggerQuery(program.query, userInputTriggerName, emptyUserInputQuery);
				const scrollToLatest = readScrollTriggerQuery(program.query, scrollToLatestTriggerName, {
					fired: false,
					count: 0,
					sourceElement: null,
					lastFiredAt: null,
				});
				const groupDelta = readScrollTriggerQuery(program.query, groupDeltaTriggerName, emptyDeltaQuery);
				const groupInsertLatest = readScrollTriggerQuery(program.query, groupInsertLatestTriggerName, emptyInsertQuery('latest'));
				const groupInsertOlder = readScrollTriggerQuery(program.query, groupInsertOlderTriggerName, emptyInsertQuery('older'));
				const overflow = readScrollTriggerQuery(program.query, overflowTriggerName, emptyOverflowQuery);
				const shouldSyncInitialLatest = initialLatestSyncPending && groupsState.loaded && groups.length > 0;
				const wasAtLatest = edge.atLatest || edge.leftLatest || previousEdgeAtLatest;
				const wasAtStart = edge.atStart || edge.leftStart || previousEdgeAtStart;
				const appendGroupAnchors = groupDelta.insertedKeys.map((groupId) => ({
					selector: resolveGroupSelector(groupId),
				}));
				previousEdgeAtLatest = edge.atLatest;
				previousEdgeAtStart = edge.atStart;

				switch (true) {
					case scrollToLatest.fired:
						return runProgramTx(
							program,
							async (tx) => {
								await tx.scroll.pinLatest({
									behavior: 'smooth',
									debugLabel: 'runtime-heartbeat-scroll-to-latest',
								});
							},
							{
								priority: 'user-blocking',
								debugLabel: 'runtime-heartbeat-scroll-to-latest',
							},
						);
					case shouldSyncInitialLatest && !userInput.active:
						initialLatestSyncPending = false;
						initialLatestSyncHandled = true;
						return runProgramTx(
							program,
							async (tx) => {
								await tx.scroll.pinLatest({
									behavior: 'auto',
									debugLabel: 'runtime-heartbeat-initial-latest-sync',
								});
							},
							{
								priority: 'background',
								debugLabel: 'runtime-heartbeat-initial-latest-sync',
							},
						);
					case groupDelta.changed &&
						groupDelta.direction === 'append' &&
						!wasAtLatest &&
						appendGroupAnchors.length > 0:
						return runProgramTx(
							program,
							async (tx) => {
								tx.mutation.append({
									inserted: appendGroupAnchors,
								});
								tx.anchor.preserve();
								await tx.commit();
							},
							{
								priority: 'background',
								interruptionPolicy: 'protected',
								debugLabel: 'runtime-heartbeat-append-preserve-away',
							},
						);
					case groupDelta.changed &&
						groupDelta.direction === 'replace' &&
						!groupInsertLatest.changed &&
						!groupInsertOlder.changed &&
						wasAtLatest:
						return runProgramTx(
							program,
							async (tx) => {
								await tx.scroll.pinLatest({
									behavior: 'auto',
									debugLabel: 'runtime-heartbeat-replace-latest',
								});
							},
							{
								priority: 'background',
								debugLabel: 'runtime-heartbeat-replace-latest',
							},
						);
					case overflow.becameOverflowing || overflow.becameContained:
					case userInput.entered:
						return;
				}
			});

			return () => {
				disconnectEdge();
				disconnectUserInput();
				disconnectScrollToLatest();
				disconnectGroupDelta();
				disconnectLatestInsert();
				disconnectOlderInsert();
				disconnectOverflow();
				uninstallProgram();
			};
		});
	});

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
		bind:scrollControllerRef={internalScrollControllerRef}
		bind:scrollButtonRef={scrollToLatestButtonRef}
		items={groups}
		virtual={{
			estimateSize: (_, group) => estimateHeartbeatGroupSize(group),
			getItemKey: (_, group) => group.groupId,
			measureElement: true,
			overscan: 4,
			gap: 12,
			paddingStart: 12,
			paddingEnd: 12,
			useAnimationFrameWithResizeObserver: true,
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
			<div
				data-insert-motion={insertMotionByGroupId[group.groupId] ?? 'none'}
				data-insert-motion-key={group.groupId}
			>
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
