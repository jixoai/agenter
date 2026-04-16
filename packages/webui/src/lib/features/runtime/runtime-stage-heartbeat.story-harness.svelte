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
		type RuntimeHeartbeatProviderMetadata,
	} from './runtime-heartbeat-config-state';

	let {
		initialGroups,
		olderGroups = [],
		modelCalls = [],
		attention = null,
		sessionStatus = 'running',
		schedulerState = null,
		providerMetadata = {
			providerId: 'default',
			model: 'gpt-test',
			maxContextTokens: 128_000,
			pricingCurrency: 'USD',
			pricingBands: [
				{
					upToTokens: 128_000,
					inputPerMillion: 2.5,
					cachedInputPerMillion: null,
					outputPerMillion: 10,
				},
			],
		},
		loaded = true,
		loading = false,
		refreshing = false,
		error = null,
		compactPending = false,
		compactDisabled = false,
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
		providerMetadata?: RuntimeHeartbeatProviderMetadata | null;
		loaded?: boolean;
		loading?: boolean;
		refreshing?: boolean;
		error?: string | null;
		compactPending?: boolean;
		compactDisabled?: boolean;
		onRequestCompact?: () => void | Promise<void>;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	let groups = $state<HeartbeatGroupItem[]>([]);
	let olderLoaded = $state(false);
	const configBinding = createEmptyRuntimeHeartbeatConfigBinding();
	const fixtureResetKey = $derived(
		[
			initialGroups.map((group) => `${group.id}:${group.updatedAt}:${group.items.length}`).join('|'),
			olderGroups.map((group) => `${group.id}:${group.updatedAt}:${group.items.length}`).join('|'),
			String(loaded),
			String(loading),
			String(refreshing),
			error ?? '',
		].join('::'),
	);
	let lastFixtureResetKey = $state<string | null>(null);

	$effect(() => {
		if (fixtureResetKey === lastFixtureResetKey) {
			return;
		}
		lastFixtureResetKey = fixtureResetKey;
		groups = [...initialGroups];
		olderLoaded = false;
	});

	const handleLoadOlder = async (): Promise<{ items: number; hasMore: boolean }> => {
		if (olderLoaded || olderGroups.length === 0) {
			return { items: 0, hasMore: false };
		}
		groups = [...olderGroups, ...groups];
		olderLoaded = true;
		return { items: olderGroups.length, hasMore: false };
	};
</script>

<div
	class="grid h-[44rem] gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4"
	data-testid="runtime-heartbeat-story"
>
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
		{providerMetadata}
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
