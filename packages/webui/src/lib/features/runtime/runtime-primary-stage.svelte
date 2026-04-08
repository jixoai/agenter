<script lang="ts">
	import type {
		MessageChannelEntry,
		ModelCallItem,
		ObservabilityTraceItem,
		RuntimeAttentionState,
		RuntimeChatCycle,
		RuntimeSnapshotEntry,
		SessionEntry,
	} from '@agenter/client-sdk';

	import { Scaffold } from '@agenter/svelte-components';
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
		attention: RuntimeAttentionState | null;
		modelCalls: ModelCallItem[];
		traces: ObservabilityTraceItem[];
		activeCycle: RuntimeChatCycle | null;
		latestCycle: RuntimeChatCycle | null;
		onOpenRoom: (chatId: string) => void | Promise<void>;
		onOpenTerminal: (terminalId: string) => void | Promise<void>;
	}

	let {
		tab,
		session,
		runtime,
		channels,
		cycles,
		attention,
		modelCalls,
		traces,
		activeCycle,
		latestCycle,
		onOpenRoom,
		onOpenTerminal,
	}: Props = $props();

	const stageMeta: Record<RuntimeTabId, { title: string }> = {
		attention: {
			title: 'Attention stage',
		},
		cycles: {
			title: 'Cycle history',
		},
		systems: {
			title: 'Linked systems',
		},
		observability: {
			title: 'Observability posture',
		},
		settings: {
			title: 'Runtime-facing settings',
		},
	};

	const currentMeta = $derived(stageMeta[tab]);
</script>

<Scaffold.Root class="bg-card text-card-foreground rounded-xl border shadow-sm" data-testid="runtime-primary-stage">
	<Scaffold.Header class="grid gap-3 border-b px-6 py-4">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="grid gap-1">
				<h2 class="text-base font-semibold">{currentMeta.title}</h2>
			</div>
			<Badge variant="outline">{resolveRuntimeStatusLabel(session.status)}</Badge>
		</div>
	</Scaffold.Header>

	<Scaffold.ScrollBody contentClass="grid auto-rows-max gap-4 p-4">
		{#if tab === 'attention'}
			<RuntimeStageAttention {runtime} {channels} {onOpenRoom} {onOpenTerminal} />
		{:else if tab === 'cycles'}
			<RuntimeStageCycles {cycles} {activeCycle} {latestCycle} {attention} {modelCalls} {traces} />
		{:else if tab === 'systems'}
			<RuntimeStageSystems {runtime} {channels} />
		{:else if tab === 'observability'}
			<RuntimeStageObservability {session} {runtime} {latestCycle} />
		{:else}
			<RuntimeStageSettings {session} {runtime} />
		{/if}
	</Scaffold.ScrollBody>
</Scaffold.Root>
