<script lang="ts">
	import type { HeartbeatGroupItem, ModelCallItem, RuntimeAttentionState } from '@agenter/client-sdk';

	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';
	import { createEmptyRuntimeHeartbeatConfigBinding } from './runtime-heartbeat-config-state';

	let {
		initialGroups,
		olderGroups = [],
		modelCalls = [],
		attention = null,
		sessionIconUrl = 'https://example.test/avatar-default.webp',
		avatarLabel = 'Default Avatar',
	}: {
		initialGroups: HeartbeatGroupItem[];
		olderGroups?: HeartbeatGroupItem[];
		modelCalls?: ModelCallItem[];
		attention?: RuntimeAttentionState | null;
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
		{groups}
		{modelCalls}
		{attention}
		{sessionIconUrl}
		{avatarLabel}
		{configBinding}
		onLoadOlder={handleLoadOlder}
		onRefreshConfig={() => {}}
		onSaveConfig={() => {}}
	/>
</div>
