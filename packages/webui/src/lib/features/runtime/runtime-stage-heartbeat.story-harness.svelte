<script lang="ts">
	import type { HeartbeatPartItem } from '@agenter/client-sdk';

	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';

	let {
		initialEntries,
		olderEntries = [],
	}: {
		initialEntries: HeartbeatPartItem[];
		olderEntries?: HeartbeatPartItem[];
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
	<RuntimeStageHeartbeat {entries} onLoadOlder={handleLoadOlder} />
</div>
