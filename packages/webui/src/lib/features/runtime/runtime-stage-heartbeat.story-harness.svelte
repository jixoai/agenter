<script lang="ts">
	import type {
		RuntimeSchedulerState,
		HeartbeatGroupItem,
		ModelCallItem,
		RuntimeAttentionState,
		SessionEntry,
	} from '@agenter/client-sdk';

	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';
	import {
		createEmptyRuntimeHeartbeatConfigBinding,
	} from './runtime-heartbeat-config-state';

	type ScheduledHeartbeatUpdate =
		| {
				type: 'append-groups';
				afterMs: number;
				groups: HeartbeatGroupItem[];
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
		sessionStatus = 'running',
		schedulerState = null,
		loaded = true,
		loading = false,
		refreshing = false,
		error = null,
		compactPending = false,
		compactDisabled = false,
		scheduledUpdates = [],
		onRequestCompact = () => {},
		sessionIconUrl = 'https://example.test/avatar-default.webp',
		avatarLabel = 'Default Avatar',
	}: {
		initialGroups: HeartbeatGroupItem[];
		olderGroups?: HeartbeatGroupItem[];
		modelCalls?: ModelCallItem[];
		attention?: RuntimeAttentionState | null;
		sessionStatus?: SessionEntry['status'];
		schedulerState?: RuntimeSchedulerState | null;
		loaded?: boolean;
		loading?: boolean;
		refreshing?: boolean;
		error?: string | null;
		compactPending?: boolean;
		compactDisabled?: boolean;
		scheduledUpdates?: ScheduledHeartbeatUpdate[];
		onRequestCompact?: () => void | Promise<void>;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	let groups = $state<HeartbeatGroupItem[]>([]);
	let olderLoaded = $state(false);
	let scheduledUpdateTimers: number[] = [];
	const configBinding = createEmptyRuntimeHeartbeatConfigBinding();
	const cloneGroup = (group: HeartbeatGroupItem): HeartbeatGroupItem => structuredClone(group);
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
						: `replace-last:${update.afterMs}:${update.group.groupId}`,
				)
				.join('|'),
			String(loaded),
			String(loading),
			String(refreshing),
			error ?? '',
		].join('::'),
	);
	let lastFixtureResetKey: string | null = null;

	$effect(() => {
		if (fixtureResetKey === lastFixtureResetKey) {
			return;
		}
		lastFixtureResetKey = fixtureResetKey;
		clearScheduledUpdates();
		groups = initialGroups.map(cloneGroup);
		olderLoaded = false;
		if (typeof window === 'undefined' || scheduledUpdates.length === 0) {
			return;
		}
		scheduledUpdateTimers = scheduledUpdates.map((update) =>
			window.setTimeout(() => {
				switch (update.type) {
					case 'append-groups':
						groups = [...groups, ...update.groups.map(cloneGroup)];
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
</script>

<div
	class="grid h-[44rem] gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4"
	data-testid="runtime-heartbeat-story"
>
	<div class="sr-only" data-testid="runtime-heartbeat-story-count">{groups.length}</div>
	<RuntimeStageHeartbeat
		{sessionStatus}
		{schedulerState}
		groupsState={{
			data: groups,
			loaded,
			loading,
			refreshing,
			error,
			refreshedAt: loaded ? Date.now() : null,
		}}
		{modelCalls}
		{attention}
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
