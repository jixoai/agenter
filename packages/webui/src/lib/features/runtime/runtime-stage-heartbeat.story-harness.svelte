<script lang="ts">
	import type { HeartbeatPartItem, ModelCallItem, RuntimeAttentionState } from '@agenter/client-sdk';

	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';

	let {
		initialEntries,
		olderEntries = [],
		modelCalls = [],
		attention = null,
		sessionIconUrl = 'https://example.test/avatar-default.webp',
		avatarLabel = 'Default Avatar',
	}: {
		initialEntries: HeartbeatPartItem[];
		olderEntries?: HeartbeatPartItem[];
		modelCalls?: ModelCallItem[];
		attention?: RuntimeAttentionState | null;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	let entries = $state<HeartbeatPartItem[]>([]);
	let olderLoaded = $state(false);

	$effect(() => {
		entries = [...initialEntries];
		olderLoaded = false;
	});

	const handleLoadOlder = async (): Promise<{ items: number; hasMore: boolean }> => {
		if (olderLoaded || olderEntries.length === 0) {
			return { items: 0, hasMore: false };
		}
		entries = [...olderEntries, ...entries];
		olderLoaded = true;
		return { items: olderEntries.length, hasMore: false };
	};
</script>

<div
	class="grid h-[44rem] gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4"
	data-testid="runtime-heartbeat-story"
>
	<RuntimeStageHeartbeat {entries} {modelCalls} {attention} {sessionIconUrl} {avatarLabel} onLoadOlder={handleLoadOlder} />
</div>
