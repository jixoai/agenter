<script lang="ts">
	import type { HeartbeatGroupItem } from '@agenter/client-sdk';

	import { Button } from '$lib/components/ui/button/index.js';

	import RuntimeHeartbeatGroup from './runtime-heartbeat-group.svelte';

	let {
		group,
		sessionIconUrl = 'https://example.test/avatar-default.webp',
		avatarLabel = 'Harness Avatar',
	}: {
		group: HeartbeatGroupItem;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	let parentTick = $state(0);
	let groupState = $state<HeartbeatGroupItem | null>(null);

	$effect(() => {
		if (groupState !== null) {
			return;
		}
		groupState = structuredClone(group);
	});
</script>

<div class="grid gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4">
	<div class="flex flex-wrap items-center gap-2">
		<Button
			size="sm"
			variant="outline"
			data-testid="runtime-heartbeat-group-harness-bump-parent"
			onclick={() => {
				parentTick += 1;
			}}
		>
			Bump parent
		</Button>
		<Button
			size="sm"
			variant="outline"
			data-testid="runtime-heartbeat-group-harness-refresh-group"
			onclick={() => {
				groupState = structuredClone(groupState);
			}}
		>
			Refresh group prop
		</Button>
		<div class="text-xs text-muted-foreground" data-testid="runtime-heartbeat-group-harness-parent-tick">
			{parentTick}
		</div>
	</div>

	{#if groupState}
		<RuntimeHeartbeatGroup group={groupState} {sessionIconUrl} {avatarLabel} />
	{/if}
</div>
