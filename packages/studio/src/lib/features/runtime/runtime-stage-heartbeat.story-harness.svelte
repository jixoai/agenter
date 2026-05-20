<script lang="ts">
	import type {
		RuntimeSchedulerState,
		HeartbeatGroupItem,
		ModelCallItem,
		RuntimeAttentionDeliveryState,
		RuntimeAttentionState,
		SessionEntry,
	} from '@agenter/client-sdk';

	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';
	import {
		createEmptyRuntimeHeartbeatConfigBinding,
	} from './runtime-heartbeat-config-state';
	import { Button } from '$lib/components/ui/button/index.js';

	type InteractiveHeartbeatGroupFactory = (input: {
		count: number;
		sequence: number;
		groups: readonly HeartbeatGroupItem[];
	}) => HeartbeatGroupItem;
	type InteractiveHeartbeatControls = {
		appendLatest?: InteractiveHeartbeatGroupFactory;
		prependOlder?: InteractiveHeartbeatGroupFactory;
		replaceLatest?: InteractiveHeartbeatGroupFactory;
		hint?: string;
	};

	type ScheduledHeartbeatUpdate =
		| {
				type: 'append-groups';
				afterMs: number;
				groups: HeartbeatGroupItem[];
		  }
		| {
				type: 'hydrate-groups';
				afterMs: number;
				groups: HeartbeatGroupItem[];
				loaded?: boolean;
				loading?: boolean;
				refreshing?: boolean;
				error?: string | null;
		  }
		| {
				type: 'replace-last-group';
				afterMs: number;
				group: HeartbeatGroupItem;
		  };

	let {
		initialGroups,
		olderGroups = [],
		modelCalls = [],
		attention = null,
		attentionDelivery = null,
		sessionStatus = 'running',
		schedulerState = null,
		loaded: initialLoaded = true,
		loading: initialLoading = false,
		refreshing: initialRefreshing = false,
		error: initialError = null,
		compactPending = false,
		compactDisabled = false,
		scheduledUpdates = [],
		interactiveControls = undefined,
		onRequestCompact = () => {},
		sessionIconUrl = 'https://example.test/avatar-default.webp',
		avatarLabel = 'Default Avatar',
	}: {
		initialGroups: HeartbeatGroupItem[];
		olderGroups?: HeartbeatGroupItem[];
		modelCalls?: ModelCallItem[];
		attention?: RuntimeAttentionState | null;
		attentionDelivery?: RuntimeAttentionDeliveryState | null;
		sessionStatus?: SessionEntry['status'];
		schedulerState?: RuntimeSchedulerState | null;
		loaded?: boolean;
		loading?: boolean;
		refreshing?: boolean;
		error?: string | null;
		compactPending?: boolean;
		compactDisabled?: boolean;
		scheduledUpdates?: ScheduledHeartbeatUpdate[];
		interactiveControls?: InteractiveHeartbeatControls | undefined;
		onRequestCompact?: () => void | Promise<void>;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	let groups = $state<HeartbeatGroupItem[]>([]);
	let olderLoaded = $state(false);
	let appendCount = $state(0);
	let prependCount = $state(0);
	let replaceCount = $state(0);
	let interactiveSequence = $state(0);
	let interactiveMutationPending = $state(false);
	let loadedState = $state(false);
	let loadingState = $state(false);
	let refreshingState = $state(false);
	let errorState = $state<string | null>(null);
	let scheduledUpdateTimers: number[] = [];
	const configBinding = createEmptyRuntimeHeartbeatConfigBinding();
	const cloneGroup = (group: HeartbeatGroupItem): HeartbeatGroupItem => structuredClone(group);
	const resetGroups = (): void => {
		groups = initialGroups.map(cloneGroup);
		olderLoaded = false;
		appendCount = 0;
		prependCount = 0;
		replaceCount = 0;
		interactiveSequence = 0;
		interactiveMutationPending = false;
		loadedState = initialLoaded;
		loadingState = initialLoading;
		refreshingState = initialRefreshing;
		errorState = initialError;
	};
	const clearScheduledUpdates = (): void => {
		if (typeof window === 'undefined') {
			scheduledUpdateTimers = [];
			return;
		}
		for (const timerId of scheduledUpdateTimers) {
			window.clearTimeout(timerId);
		}
		scheduledUpdateTimers = [];
	};
	const fixtureResetKey = $derived(
		[
			initialGroups.map((group) => `${group.id}:${group.updatedAt}:${group.items.length}`).join('|'),
			olderGroups.map((group) => `${group.id}:${group.updatedAt}:${group.items.length}`).join('|'),
			scheduledUpdates
				.map((update) =>
					update.type === 'append-groups'
						? `append:${update.afterMs}:${update.groups.map((group) => group.groupId).join(',')}`
						: update.type === 'hydrate-groups'
							? `hydrate:${update.afterMs}:${update.groups.map((group) => group.groupId).join(',')}:${String(update.loaded ?? true)}:${String(update.loading ?? false)}:${String(update.refreshing ?? false)}:${update.error ?? ''}`
						: `replace-last:${update.afterMs}:${update.group.groupId}`,
				)
				.join('|'),
			String(initialLoaded),
			String(initialLoading),
			String(initialRefreshing),
			initialError ?? '',
		].join('::'),
	);
	let lastFixtureResetKey: string | null = null;

	$effect(() => {
		if (fixtureResetKey === lastFixtureResetKey) {
			return;
		}
		lastFixtureResetKey = fixtureResetKey;
		clearScheduledUpdates();
		resetGroups();
		if (typeof window === 'undefined' || scheduledUpdates.length === 0) {
			return;
		}
		scheduledUpdateTimers = scheduledUpdates.map((update) =>
			window.setTimeout(() => {
				switch (update.type) {
					case 'append-groups':
						groups = [...groups, ...update.groups.map(cloneGroup)];
						return;
					case 'hydrate-groups':
						groups = update.groups.map(cloneGroup);
						loadedState = update.loaded ?? true;
						loadingState = update.loading ?? false;
						refreshingState = update.refreshing ?? false;
						errorState = update.error ?? null;
						return;
					case 'replace-last-group':
						if (groups.length === 0) {
							groups = [cloneGroup(update.group)];
							return;
						}
						groups = [...groups.slice(0, -1), cloneGroup(update.group)];
						return;
				}
			}, update.afterMs),
		);
		return () => {
			clearScheduledUpdates();
		};
	});

	const handleLoadOlder = async (): Promise<{ items: number; hasMore: boolean }> => {
		if (olderLoaded || olderGroups.length === 0) {
			return { items: 0, hasMore: false };
		}
		groups = [...olderGroups.map(cloneGroup), ...groups];
		olderLoaded = true;
		return { items: olderGroups.length, hasMore: false };
	};

	const applyInteractiveGroup = async (
		factory: InteractiveHeartbeatGroupFactory | undefined,
		mode: 'append' | 'prepend' | 'replace',
	): Promise<void> => {
		if (!factory || interactiveMutationPending) {
			return;
		}
		const nextCount =
			mode === 'append' ? appendCount + 1 : mode === 'prepend' ? prependCount + 1 : replaceCount + 1;
		const nextSequence = interactiveSequence + 1;
		const nextGroup = cloneGroup(
			factory({
				count: nextCount,
				sequence: nextSequence,
				groups,
			}),
		);
		const applyGroupMutation = (): void => {
			switch (mode) {
				case 'append':
					appendCount = nextCount;
					interactiveSequence = nextSequence;
					groups = [...groups, nextGroup];
					return;
				case 'prepend':
					prependCount = nextCount;
					interactiveSequence = nextSequence;
					groups = [nextGroup, ...groups];
					return;
				case 'replace':
					replaceCount = nextCount;
					interactiveSequence = nextSequence;
					if (groups.length === 0) {
						groups = [nextGroup];
						return;
					}
					groups = [...groups.slice(0, -1), nextGroup];
					return;
			}
		};
		interactiveMutationPending = true;
		try {
			applyGroupMutation();
		} catch (error) {
			throw error;
		} finally {
			interactiveMutationPending = false;
		}
	};
</script>

<div
	class="grid h-[44rem] gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4"
	data-testid="runtime-heartbeat-story"
>
	{#if interactiveControls}
		<section
			class="grid gap-2 rounded-2xl border border-border/70 bg-background/85 px-3 py-3 shadow-sm"
			data-testid="runtime-heartbeat-playground-controls"
		>
			<div class="flex flex-wrap items-center gap-2">
				{#if interactiveControls.appendLatest}
					<Button
						size="sm"
						variant="outline"
						disabled={interactiveMutationPending}
						data-testid="runtime-heartbeat-playground-append-latest"
						onclick={() => void applyInteractiveGroup(interactiveControls.appendLatest, 'append')}
					>
						Append latest
					</Button>
				{/if}
				{#if interactiveControls.prependOlder}
					<Button
						size="sm"
						variant="outline"
						disabled={interactiveMutationPending}
						data-testid="runtime-heartbeat-playground-prepend-older"
						onclick={() => void applyInteractiveGroup(interactiveControls.prependOlder, 'prepend')}
					>
						Prepend older
					</Button>
				{/if}
				{#if interactiveControls.replaceLatest}
					<Button
						size="sm"
						variant="outline"
						disabled={interactiveMutationPending}
						data-testid="runtime-heartbeat-playground-grow-latest"
						onclick={() => void applyInteractiveGroup(interactiveControls.replaceLatest, 'replace')}
					>
						Grow latest
					</Button>
				{/if}
				<Button
					size="sm"
					variant="secondary"
					data-testid="runtime-heartbeat-playground-reset"
					onclick={resetGroups}
				>
					Reset
				</Button>
			</div>
			{#if interactiveControls.hint}
				<p class="text-xs text-muted-foreground" data-testid="runtime-heartbeat-playground-hint">
					{interactiveControls.hint}
				</p>
			{/if}
		</section>
	{/if}
	<div class="sr-only" data-testid="runtime-heartbeat-story-count">{groups.length}</div>
	<RuntimeStageHeartbeat
		{sessionStatus}
		{schedulerState}
		groupsState={{
			data: groups,
			loaded: loadedState,
			loading: loadingState,
			refreshing: refreshingState,
			error: errorState,
			refreshedAt: loadedState ? Date.now() : null,
		}}
		{modelCalls}
		{attention}
		{attentionDelivery}
		{compactPending}
		{compactDisabled}
		{onRequestCompact}
		{sessionIconUrl}
		{avatarLabel}
		{configBinding}
		onLoadOlder={handleLoadOlder}
		onRefreshConfig={() => {}}
		onSaveConfig={() => true}
	/>
</div>
