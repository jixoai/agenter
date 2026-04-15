<script lang="ts">
	import type { HeartbeatGroupItem, ModelCallItem, RuntimeAttentionState } from '@agenter/client-sdk';
	import { tick } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import {
		ConversationEmptyState,
		VirtualConversation,
	} from '$lib/components/ai-elements/conversation/index.js';

	import type { RuntimeHeartbeatConfigBinding, RuntimeHeartbeatConfigDraft } from './runtime-heartbeat-config-state';
	import RuntimeHeartbeatStatusbar from './runtime-heartbeat-statusbar.svelte';
	import {
		buildHeartbeatAttentionFocusSummary,
		buildHeartbeatContextState,
	} from './runtime-heartbeat-statusbar-state';
	import {
		estimateHeartbeatGroupSize,
	} from './runtime-heartbeat-parts';
	import RuntimeHeartbeatGroup from './runtime-heartbeat-group.svelte';

	let {
		groups,
		modelCalls = [],
		attention = null,
		onLoadOlder,
		configBinding,
		configLoading = false,
		configSaving = false,
		configError = null,
		onRefreshConfig,
		onSaveConfig,
		sessionIconUrl = null,
		avatarLabel = 'Avatar',
	}: {
		groups: HeartbeatGroupItem[];
		modelCalls?: ModelCallItem[];
		attention?: RuntimeAttentionState | null;
		onLoadOlder: () => Promise<{ items: number; hasMore: boolean }>;
		configBinding: RuntimeHeartbeatConfigBinding;
		configLoading?: boolean;
		configSaving?: boolean;
		configError?: string | null;
		onRefreshConfig: () => void | Promise<void>;
		onSaveConfig: (draft: RuntimeHeartbeatConfigDraft) => void | Promise<void>;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	let loadingOlder = $state(false);
	let hasMoreOlder = $state(true);
	let viewportAtTop = $state(false);
	let viewportRef = $state<HTMLDivElement | null>(null);

	const contextState = $derived(buildHeartbeatContextState(modelCalls));
	const shimmerSummary = $derived(buildHeartbeatAttentionFocusSummary(attention, modelCalls));
	const rowCount = $derived(groups.reduce((total, group) => total + group.items.length, 0));
	const showTopLoadAffordance = $derived(groups.length > 0 && viewportAtTop);

	const scrollViewportToTop = async (): Promise<void> => {
		await tick();
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					resolve();
				});
			});
		});
		if (!viewportRef) {
			return;
		}
		viewportRef.scrollTo({ top: 0, behavior: 'auto' });
		viewportAtTop = true;
		viewportRef.dispatchEvent(new Event('scroll'));
	};

	const loadOlder = async (): Promise<void> => {
		if (loadingOlder || !hasMoreOlder) {
			return;
		}
		loadingOlder = true;
		try {
			const result = await onLoadOlder();
			hasMoreOlder = result.hasMore;
			await scrollViewportToTop();
		} finally {
			loadingOlder = false;
		}
	};
</script>

<div
	class="relative grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_6%)_0%,var(--card)_18%,color-mix(in_srgb,var(--background),var(--card)_42%)_100%)]"
	data-testid="runtime-heartbeat-stage"
>
	{#if showTopLoadAffordance}
		<div class="absolute inset-x-0 top-3 z-10 flex justify-center px-3">
			{#if hasMoreOlder}
				<Button
					variant="outline"
					size="sm"
					class="rounded-full bg-background/88 shadow-sm"
					disabled={loadingOlder}
					onclick={() => void loadOlder()}
				>
					{loadingOlder ? 'Loading older…' : 'Load older'}
				</Button>
			{:else}
				<div class="rounded-full border border-border/60 bg-background/88 px-3 py-1 text-xs text-muted-foreground shadow-sm">
					No older messages
				</div>
			{/if}
		</div>
	{/if}

	<VirtualConversation
		class="h-full min-h-0"
		contentClass="px-3"
		viewportTestId="runtime-heartbeat-viewport"
		bind:atTop={viewportAtTop}
		bind:viewportRef
		items={groups}
		virtual={{
			estimateSize: (_, group) => estimateHeartbeatGroupSize(group),
			getItemKey: (_, group) => group.groupId,
			overscan: 4,
			gap: 12,
			paddingStart: 12,
			paddingEnd: 12,
		}}
	>
		{#snippet renderItem(group)}
			<RuntimeHeartbeatGroup {group} {sessionIconUrl} {avatarLabel} />
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
		entryCount={rowCount}
		{configBinding}
		{configLoading}
		{configSaving}
		{configError}
		onRefreshConfig={onRefreshConfig}
		onSaveConfig={onSaveConfig}
	/>
</div>
