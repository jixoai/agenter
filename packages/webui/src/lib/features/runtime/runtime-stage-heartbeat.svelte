<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';

	import type { HeartbeatPartItem } from '@agenter/client-sdk';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import RuntimeHeartbeatEntry from './runtime-heartbeat-entry.svelte';

	let {
		entries,
		onLoadOlder,
	}: {
		entries: HeartbeatPartItem[];
		onLoadOlder: () => Promise<{ items: number; hasMore: boolean }>;
	} = $props();

	let loadingOlder = $state(false);
	let hasMoreOlder = $state(true);

	const loadOlder = async (): Promise<void> => {
		if (loadingOlder || !hasMoreOlder) {
			return;
		}
		loadingOlder = true;
		try {
			const result = await onLoadOlder();
			hasMoreOlder = result.hasMore;
		} finally {
			loadingOlder = false;
		}
	};
</script>

<div
	class="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4"
	style="min-block-size: 0;"
	data-testid="runtime-heartbeat-stage"
>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="grid gap-1">
			<div class="text-sm font-semibold">Heartbeat message-parts</div>
			<div class="text-xs text-muted-foreground">
				This stream now follows durable Heartbeat rows directly: folded bootstrap facts, compact boundaries, and AI-visible request/response parts.
			</div>
		</div>
		<Button variant="outline" disabled={loadingOlder || !hasMoreOlder} onclick={() => void loadOlder()}>
			{loadingOlder ? 'Loading older…' : hasMoreOlder ? 'Load older' : 'History loaded'}
		</Button>
	</div>

	<Card.Root style="min-block-size: 0;">
		<Card.Content class="p-0" style="min-block-size: 0;">
			{#if entries.length === 0}
				<div
					class="grid h-full place-items-center px-6 py-12 text-center"
					data-testid="runtime-heartbeat-empty"
				>
					<div class="grid max-w-md gap-2">
						<div class="text-sm font-semibold">No Heartbeat rows yet</div>
						<div class="text-sm text-muted-foreground">
							Persisted Heartbeat message-parts will appear here as soon as the runtime records prompt facts, attention inputs, or assistant output.
						</div>
					</div>
				</div>
			{:else}
				<ScrollView class="h-full" contentClass="grid gap-3 p-3">
					{#each entries as entry (entry.id)}
						<RuntimeHeartbeatEntry {entry} />
					{/each}
				</ScrollView>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
