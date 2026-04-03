<script lang="ts">
	import type {
		MessageChannelEntry,
		RuntimeChatCycle,
		RuntimeSnapshotEntry,
		SessionEntry,
	} from '@agenter/client-sdk';

	import PanelShell from '$lib/components/panel-shell.svelte';
	import ScrollView from '$lib/components/scroll-view.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';

	import RuntimeStageAttention from './runtime-stage-attention.svelte';
	import RuntimeStageCycles from './runtime-stage-cycles.svelte';
	import RuntimeStageObservability from './runtime-stage-observability.svelte';
	import RuntimeStageSettings from './runtime-stage-settings.svelte';
	import RuntimeStageSystems from './runtime-stage-systems.svelte';
	import { resolveRuntimeStatusLabel, type RuntimeTabId } from './runtime-shell-state';

	interface Props {
		tab: RuntimeTabId;
		session: SessionEntry;
		runtime: RuntimeSnapshotEntry | null;
		channels: MessageChannelEntry[];
		cycles: RuntimeChatCycle[];
		activeCycle: RuntimeChatCycle | null;
		latestCycle: RuntimeChatCycle | null;
	}

	let {
		tab,
		session,
		runtime,
		channels,
		cycles,
		activeCycle,
		latestCycle,
	}: Props = $props();

	const stageMeta: Record<RuntimeTabId, { title: string; description: string }> = {
		attention: {
			title: 'Attention stage',
			description: 'Current runtime pressure, active contexts, and recent attention hooks.',
		},
		cycles: {
			title: 'Cycle history',
			description: 'Wake sources, protocol kinds, and cycle envelopes for the running avatar.',
		},
		systems: {
			title: 'Linked systems',
			description: 'Orthogonal room and terminal attachments consumed by this runtime.',
		},
		observability: {
			title: 'Observability posture',
			description: 'Containment facts, scheduler diagnostics, and recent runtime errors.',
		},
		settings: {
			title: 'Runtime-facing settings',
			description: 'Stable runtime identity and model capabilities without leaving the shell.',
		},
	};

	const currentMeta = $derived(stageMeta[tab]);
</script>

<PanelShell bodyClass="h-full" data-testid="runtime-primary-stage">
	{#snippet header()}
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="grid gap-1">
				<h2 class="text-base font-semibold">{currentMeta.title}</h2>
				<p class="text-sm text-muted-foreground">{currentMeta.description}</p>
			</div>
			<Badge variant="outline">{resolveRuntimeStatusLabel(session.status)}</Badge>
		</div>
	{/snippet}

	<ScrollView class="h-full" contentClass="grid auto-rows-max gap-4 p-4">
		{#if tab === 'attention'}
			<RuntimeStageAttention {runtime} />
		{:else if tab === 'cycles'}
			<RuntimeStageCycles {cycles} {activeCycle} {latestCycle} />
		{:else if tab === 'systems'}
			<RuntimeStageSystems {runtime} {channels} />
		{:else if tab === 'observability'}
			<RuntimeStageObservability {session} {runtime} {latestCycle} />
		{:else}
			<RuntimeStageSettings {session} {runtime} />
		{/if}
	</ScrollView>
</PanelShell>
