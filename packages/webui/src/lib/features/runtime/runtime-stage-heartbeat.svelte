<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import type { RuntimeChatMessage } from '@agenter/client-sdk';
	import RuntimeHeartbeatCompactSeparator from './runtime-heartbeat-compact-separator.svelte';
	import RuntimeHeartbeatMessage from './runtime-heartbeat-message.svelte';

	let {
		messages,
		onLoadOlder,
	}: {
		messages: RuntimeChatMessage[];
		onLoadOlder: () => Promise<{ items: number; hasMore: boolean }>;
	} = $props();

	let loadingOlder = $state(false);
	let hasMoreOlder = $state(true);

	const sortedMessages = $derived([...messages].sort((left, right) => left.timestamp - right.timestamp));

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
			<div class="text-sm font-semibold">AI-call ledger</div>
			<div class="text-xs text-muted-foreground">
				Heartbeat projects persisted user, assistant, and compact-boundary rows out of the runtime ledger.
			</div>
		</div>
		<Button variant="outline" disabled={loadingOlder || !hasMoreOlder} onclick={() => void loadOlder()}>
			{loadingOlder ? 'Loading older…' : hasMoreOlder ? 'Load older' : 'History loaded'}
		</Button>
	</div>

	<Card.Root style="min-block-size: 0;">
		<Card.Content class="p-0" style="min-block-size: 0;">
			<ScrollView
				class="h-full"
				virtual={{
					items: sortedMessages,
					estimateSize: (_, message) =>
						message.heartbeatKind === 'compact_separator' ? 108 : message.content.length > 240 ? 196 : 132,
					getItemKey: (_, message) => message.id,
					measureElement: true,
					overscan: 6,
				}}
			>
				{#snippet item(message)}
					{#if message.heartbeatKind === 'compact_separator'}
						<RuntimeHeartbeatCompactSeparator {message} />
					{:else}
						<RuntimeHeartbeatMessage {message} />
					{/if}
				{/snippet}
			</ScrollView>
		</Card.Content>
	</Card.Root>
</div>
