<script lang="ts">
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import { onMount } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';

	import {
		buildHeartbeatDetailAppViewUrl,
		buildHeartbeatListAppViewUrl,
		isHeartbeatRecordSelectMessage,
	} from './runtime-heartbeat-app-view-url';

	let {
		sessionId,
		avatarLabel = 'Avatar',
		heartbeatRepairVersion = 0,
	}: {
		sessionId: string;
		avatarLabel?: string;
		heartbeatRepairVersion?: number;
	} = $props();

	let selectedRecordId = $state<number | null>(null);
	let detailOpen = $state(true);
	let detailCompact = $state(false);
	let activeSessionId = $state<string | null>(null);

	const listUrl = $derived(buildHeartbeatListAppViewUrl(sessionId, heartbeatRepairVersion));
	const detailUrl = $derived(
		buildHeartbeatDetailAppViewUrl({ runtimeId: sessionId, recordId: selectedRecordId, refreshVersion: heartbeatRepairVersion }),
	);
	const detailTitle = $derived(
		selectedRecordId === null ? `${avatarLabel} Heartbeat detail` : `${avatarLabel} Heartbeat record ${selectedRecordId}`,
	);

	$effect(() => {
		if (activeSessionId === null) {
			activeSessionId = sessionId;
			return;
		}
		if (activeSessionId === sessionId) {
			return;
		}
		activeSessionId = sessionId;
		selectedRecordId = null;
		detailOpen = true;
	});

	$effect(() => {
		if (heartbeatRepairVersion <= 0) {
			return;
		}
		selectedRecordId = null;
		detailOpen = true;
	});

	const handleMessage = (event: MessageEvent): void => {
		if (event.origin !== window.location.origin) {
			return;
		}
		if (!isHeartbeatRecordSelectMessage(event.data) || event.data.runtimeId !== sessionId) {
			return;
		}
		selectedRecordId = event.data.recordId;
		detailOpen = true;
	};

	onMount(() => {
		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	});
</script>

<WorkbenchPageContent
	class="runtime-heartbeat-embed-stage"
	detailLayout="split-detail"
	bind:detailOpen
	bind:detailCompact
	detailRatioPersistence={`runtime:heartbeat:${sessionId}:detail`}
	detailLeftMin={360}
	detailRightMin={320}
	detailDefaultRatio={0.56}
	detailCloseLabel="Close Heartbeat detail"
	data-testid="runtime-heartbeat-embed-stage"
>
	{#snippet main()}
		<div class="runtime-heartbeat-embed-stage__frame-shell" data-testid="runtime-heartbeat-list-frame-shell">
			<iframe
				class="runtime-heartbeat-embed-stage__frame"
				data-testid="runtime-heartbeat-list-frame"
				title={`${avatarLabel} Heartbeat records`}
				src={listUrl}
			></iframe>
		</div>
	{/snippet}

	{#snippet drawer()}
		<div class="runtime-heartbeat-embed-stage__detail" data-testid="runtime-heartbeat-detail-frame-shell">
			<iframe
				class="runtime-heartbeat-embed-stage__frame"
				data-testid="runtime-heartbeat-detail-frame"
				title={detailTitle}
				src={detailUrl}
			></iframe>
			{#if selectedRecordId === null}
				<div class="runtime-heartbeat-embed-stage__empty-overlay" data-testid="runtime-heartbeat-detail-empty">
					<Empty.Root class="min-h-full">
						<Empty.Header>
							<Empty.Title>Select a Heartbeat record</Empty.Title>
							<Empty.Description>
								Choose a record in the list to inspect its detailed timeline, tool calls, thinking, config, or compact context.
							</Empty.Description>
						</Empty.Header>
						<Empty.Content>
							<Button variant="outline" size="sm" onclick={() => (detailOpen = true)}>
								<PanelRightOpenIcon class="size-4" aria-hidden="true" />
								Open detail
							</Button>
						</Empty.Content>
					</Empty.Root>
				</div>
			{/if}
		</div>
	{/snippet}
</WorkbenchPageContent>

<style>
	:global(.runtime-heartbeat-embed-stage) {
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}

	.runtime-heartbeat-embed-stage__frame-shell,
	.runtime-heartbeat-embed-stage__detail {
		position: relative;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--border), transparent 30%);
		border-radius: 1rem;
		background: var(--background);
	}

	.runtime-heartbeat-embed-stage__frame {
		display: block;
		inline-size: 100%;
		block-size: 100%;
		border: 0;
		background: transparent;
	}

	.runtime-heartbeat-embed-stage__empty-overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--background), transparent 6%);
		backdrop-filter: blur(1px);
	}
</style>
