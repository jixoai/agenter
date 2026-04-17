<script lang="ts">
	import type {
		CachedResourceState,
		HeartbeatGroupItem,
		ModelCallItem,
		RuntimeAttentionState,
		RuntimeSchedulerState,
		SessionEntry,
	} from '@agenter/client-sdk';
	import { tick } from 'svelte';

	import { Loader } from '$lib/components/ai-elements/loader/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		ConversationEmptyState,
		VirtualConversation,
	} from '$lib/components/ai-elements/conversation/index.js';

	import type {
		RuntimeHeartbeatConfigBinding,
		RuntimeHeartbeatConfigDraft,
		RuntimeHeartbeatProviderMetadata,
	} from './runtime-heartbeat-config-state';
	import RuntimeHeartbeatStatusbar from './runtime-heartbeat-statusbar.svelte';
	import {
		buildHeartbeatAttentionFocusSummary,
		buildHeartbeatContextState,
		buildHeartbeatStatusState,
	} from './runtime-heartbeat-statusbar-state';
	import { buildHeartbeatDisplayGroups, estimateHeartbeatGroupSize } from './runtime-heartbeat-parts';
	import RuntimeHeartbeatGroup from './runtime-heartbeat-group.svelte';

	let {
		sessionStatus,
		schedulerState = null,
		groupsState,
		modelCalls = [],
		attention = null,
		providerMetadata = null,
		compactPending = false,
		compactDisabled = false,
		onRequestCompact,
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
		sessionStatus: SessionEntry['status'];
		schedulerState?: RuntimeSchedulerState | null;
		groupsState: CachedResourceState<HeartbeatGroupItem[]>;
		modelCalls?: ModelCallItem[];
		attention?: RuntimeAttentionState | null;
		providerMetadata?: RuntimeHeartbeatProviderMetadata | null;
		compactPending?: boolean;
		compactDisabled?: boolean;
		onRequestCompact: () => void | Promise<void>;
		onLoadOlder: () => Promise<{ items: number; hasMore: boolean }>;
		configBinding: RuntimeHeartbeatConfigBinding;
		configLoading?: boolean;
		configSaving?: boolean;
		configError?: string | null;
		onRefreshConfig: () => void | Promise<void>;
		onSaveConfig: (draft: RuntimeHeartbeatConfigDraft) => boolean | Promise<boolean>;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	let loadingOlder = $state(false);
	let hasMoreOlder = $state(true);
	let viewportAtTop = $state(false);
	let viewportRef = $state<HTMLDivElement | null>(null);

	const groups = $derived(buildHeartbeatDisplayGroups(groupsState.data));
	const contextState = $derived(buildHeartbeatContextState(modelCalls, providerMetadata));
	const shimmerSummary = $derived(buildHeartbeatAttentionFocusSummary(attention));
	const statusState = $derived(
		buildHeartbeatStatusState({
			sessionStatus,
			schedulerState,
			heartbeatGroups: groupsState,
		}),
	);
	const showTopLoadAffordance = $derived(groupsState.loaded && groups.length > 0 && viewportAtTop);
	const groupCount = $derived(groups.length);
	const groupCountVisible = $derived(groupsState.loaded);
	const secondaryStatus = $derived.by(() => {
		if (groupsState.refreshing) {
			return 'Refreshing persisted Heartbeat…';
		}
		if (groupsState.loaded && groupsState.error) {
			return groupsState.error;
		}
		return null;
	});
	const emptyState = $derived.by(() => {
		if (groupsState.error && !groupsState.loaded) {
			return {
				title: 'Heartbeat failed to load',
				description: groupsState.error,
			};
		}
		if (!groupsState.loaded) {
			return {
				title: 'Loading Heartbeat…',
				description: 'Replaying persisted prompt facts, attention inputs, and assistant output.',
			};
		}
		return {
			title: 'No Heartbeat rows yet',
			description: 'Persisted Heartbeat message-parts will appear here as soon as the runtime records prompt facts, attention inputs, or assistant output.',
		};
	});

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
	class="runtime-heartbeat-stage relative grid h-full min-w-0 grid-rows-[minmax(0,1fr)_auto] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_6%)_0%,var(--card)_18%,color-mix(in_srgb,var(--background),var(--card)_42%)_100%)]"
	data-testid="runtime-heartbeat-stage"
>
	{#if secondaryStatus}
		<div class="absolute inset-x-0 top-3 z-10 flex justify-center px-3">
			<div class="rounded-full border border-border/60 bg-background/88 px-3 py-1 text-xs text-muted-foreground shadow-sm">
				{secondaryStatus}
			</div>
		</div>
	{/if}

	<VirtualConversation
		class="h-full min-w-0"
		contentClass="px-3"
		viewportTestId="runtime-heartbeat-viewport"
		bind:atTop={viewportAtTop}
		bind:viewportRef
		items={groups}
		virtual={{
			estimateSize: (_, group) => estimateHeartbeatGroupSize(group),
			getItemKey: (_, group) => group.groupId,
			measureElement: true,
			overscan: 4,
			gap: 12,
			paddingStart: 12,
			paddingEnd: 12,
		}}
	>
		{#snippet renderBefore()}
			{#if showTopLoadAffordance}
				<div class="flex justify-center px-3 pb-2 pt-12">
					{#if hasMoreOlder}
						<Button
							variant="outline"
							size="sm"
							class="rounded-full bg-background/88 shadow-sm"
							disabled={loadingOlder}
							onclick={() => void loadOlder()}
						>
							{#if loadingOlder}
								<Loader label="Loading older" />
							{:else}
								Load older
							{/if}
						</Button>
					{:else}
						<div class="rounded-full border border-border/60 bg-background/88 px-3 py-1 text-xs text-muted-foreground shadow-sm">
							No older messages
						</div>
					{/if}
				</div>
			{/if}
		{/snippet}

		{#snippet renderItem(group)}
			<RuntimeHeartbeatGroup {group} {sessionIconUrl} {avatarLabel} />
		{/snippet}

		{#snippet renderEmpty()}
			<ConversationEmptyState
				class="px-6 py-12"
				data-testid="runtime-heartbeat-empty"
				title={emptyState.title}
				description={emptyState.description}
			/>
		{/snippet}
	</VirtualConversation>

	<RuntimeHeartbeatStatusbar
		{statusState}
		{contextState}
		{shimmerSummary}
		{groupCount}
		{groupCountVisible}
		{compactPending}
		{compactDisabled}
		{configBinding}
		{configLoading}
		{configSaving}
		{configError}
		{onRequestCompact}
		onRefreshConfig={onRefreshConfig}
		onSaveConfig={onSaveConfig}
	/>
</div>

<style>
	.runtime-heartbeat-stage {
		min-block-size: 0;
	}
</style>
