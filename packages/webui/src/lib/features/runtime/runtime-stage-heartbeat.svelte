<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import type { ModelCallDeltaItem, ModelCallItem, RequestAuxItem, RuntimeChatMessage } from '@agenter/client-sdk';
	import RuntimeHeartbeatModelCall from './runtime-heartbeat-model-call.svelte';
	import RuntimeHeartbeatCompactSeparator from './runtime-heartbeat-compact-separator.svelte';
	import RuntimeHeartbeatMessage from './runtime-heartbeat-message.svelte';
	import RuntimeHeartbeatRequestAux from './runtime-heartbeat-request-aux.svelte';
	import { buildRuntimeHeartbeatTimeline } from './runtime-heartbeat-timeline';

	let {
		messages,
		requestAux,
		modelCalls,
		modelCallDeltas,
		onLoadOlder,
	}: {
		messages: RuntimeChatMessage[];
		requestAux: RequestAuxItem[];
		modelCalls: ModelCallItem[];
		modelCallDeltas: ModelCallDeltaItem[];
		onLoadOlder: () => Promise<{ items: number; hasMore: boolean }>;
	} = $props();

	let loadingOlder = $state(false);
	let hasMoreOlder = $state(true);

	const timeline = $derived(
		buildRuntimeHeartbeatTimeline({
			messages,
			requestAux,
			modelCalls,
			modelCallDeltas,
		}),
	);

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
				Heartbeat now projects persisted messages, request-side bootstrap facts, and model-call inspection cards in one ordered stream.
			</div>
		</div>
		<Button variant="outline" disabled={loadingOlder || !hasMoreOlder} onclick={() => void loadOlder()}>
			{loadingOlder ? 'Loading older…' : hasMoreOlder ? 'Load older' : 'History loaded'}
		</Button>
	</div>

	<Card.Root style="min-block-size: 0;">
		<Card.Content class="p-0" style="min-block-size: 0;">
			{#if timeline.length === 0}
				<div
					class="grid h-full place-items-center px-6 py-12 text-center"
					data-testid="runtime-heartbeat-empty"
				>
					<div class="grid max-w-md gap-2">
						<div class="text-sm font-semibold">No Heartbeat rows yet</div>
						<div class="text-sm text-muted-foreground">
							Persisted Heartbeat messages, request bootstrap facts, and model-call cards will appear here once the runtime records them.
						</div>
					</div>
				</div>
			{:else}
				<ScrollView
					class="h-full"
					virtual={{
						items: timeline,
						estimateSize: (_, item) =>
							item.kind === 'heartbeat'
								? item.message.heartbeatKind === 'compact_separator'
									? 108
									: item.message.content.length > 240
										? 196
										: 132
								: item.kind === 'request_aux'
									? 236
									: 320,
						getItemKey: (_, item) => item.id,
						measureElement: true,
						overscan: 6,
					}}
				>
					{#snippet item(item)}
						{#if item.kind === 'heartbeat'}
							{#if item.message.heartbeatKind === 'compact_separator'}
								<RuntimeHeartbeatCompactSeparator message={item.message} />
							{:else}
								<RuntimeHeartbeatMessage message={item.message} />
							{/if}
						{:else if item.kind === 'request_aux'}
							<RuntimeHeartbeatRequestAux entry={item.entry} />
						{:else}
							<RuntimeHeartbeatModelCall entry={item.entry} liveDeltas={item.liveDeltas} />
						{/if}
					{/snippet}
				</ScrollView>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
