<script lang="ts">
	import type { HeartbeatPartItem, ModelCallItem, RuntimeAttentionState } from '@agenter/client-sdk';

	import {
		ConversationEmptyState,
		VirtualConversation,
	} from '$lib/components/ai-elements/conversation/index.js';

	import RuntimeHeartbeatEntry from './runtime-heartbeat-entry.svelte';
	import RuntimeHeartbeatStatusbar from './runtime-heartbeat-statusbar.svelte';
	import {
		buildHeartbeatAttentionFocusSummary,
		buildHeartbeatContextState,
	} from './runtime-heartbeat-statusbar-state';
	import { estimateHeartbeatEntrySize } from './runtime-heartbeat-parts';

	let {
		entries,
		modelCalls = [],
		attention = null,
		onLoadOlder,
	}: {
		entries: HeartbeatPartItem[];
		modelCalls?: ModelCallItem[];
		attention?: RuntimeAttentionState | null;
		onLoadOlder: () => Promise<{ items: number; hasMore: boolean }>;
	} = $props();

	let loadingOlder = $state(false);
	let hasMoreOlder = $state(true);

	const contextState = $derived(buildHeartbeatContextState(modelCalls));
	const shimmerSummary = $derived(buildHeartbeatAttentionFocusSummary(attention, modelCalls));

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
	class="grid h-full min-h-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_6%)_0%,var(--card)_18%,color-mix(in_srgb,var(--background),var(--card)_42%)_100%)]"
	data-testid="runtime-heartbeat-stage"
>
	<div class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]">
		<VirtualConversation
			class="h-full"
			contentClass="px-3"
			viewportTestId="runtime-heartbeat-viewport"
			items={entries}
			virtual={{
				estimateSize: (_, entry) => estimateHeartbeatEntrySize(entry),
				getItemKey: (_, entry) => entry.id,
				measureElement: true,
				overscan: 10,
				gap: 12,
				paddingStart: 12,
				paddingEnd: 12,
				useAnimationFrameWithResizeObserver: true,
			}}
		>
			{#snippet renderItem(entry)}
				<div data-testid={`runtime-heartbeat-row-${entry.id}`}>
					<RuntimeHeartbeatEntry {entry} />
				</div>
			{/snippet}

			{#snippet renderEmpty()}
				<ConversationEmptyState
					class="px-6 py-12"
					data-testid="runtime-heartbeat-empty"
					title="No Heartbeat rows yet"
					description="Persisted Heartbeat message-parts will appear here as soon as the runtime records prompt facts, attention inputs, or assistant output."
				/>
			{/snippet}
		</VirtualConversation>

		<RuntimeHeartbeatStatusbar
			{contextState}
			{shimmerSummary}
			entryCount={entries.length}
			{loadingOlder}
			{hasMoreOlder}
			onLoadOlder={loadOlder}
		/>
	</div>
</div>
