<script lang="ts">
	import type {
		ModelCallDeltaItem,
		ModelCallItem,
		MessageChannelEntry,
		RequestAuxItem,
		RuntimeChatMessage,
		RuntimeSnapshotEntry,
		SessionNotificationItem,
		SessionEntry,
	} from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Scaffold } from '@agenter/svelte-components';

	import RuntimeStageAttention from './runtime-stage-attention.svelte';
	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';
	import RuntimeStageSettings from './runtime-stage-settings.svelte';
	import { resolveRuntimeStatusLabel, type RuntimeTabId } from './runtime-shell-state';

	interface Props {
		tab: RuntimeTabId;
		session: SessionEntry;
		runtime: RuntimeSnapshotEntry | null;
		channels: MessageChannelEntry[];
		notifications: SessionNotificationItem[];
		messages: RuntimeChatMessage[];
		requestAux: RequestAuxItem[];
		modelCalls: ModelCallItem[];
		modelCallDeltas: ModelCallDeltaItem[];
		onOpenRoom: (chatId: string) => void | Promise<void>;
		onOpenTerminal: (terminalId: string) => void | Promise<void>;
		onSetRoomVisibility: (chatId: string, focused: boolean) => void | Promise<void>;
		onSetTerminalVisibility: (terminalId: string, focused: boolean) => void | Promise<void>;
		onConsumeNotification: (input: {
			chatId?: string;
			terminalId?: string;
			upToMessageId?: string | null;
		}) => void | Promise<void>;
		onLoadOlderHeartbeat: () => Promise<{ items: number; hasMore: boolean }>;
	}

	let {
		tab,
		session,
		runtime,
		channels,
		notifications,
		messages,
		requestAux,
		modelCalls,
		modelCallDeltas,
		onOpenRoom,
		onOpenTerminal,
		onSetRoomVisibility,
		onSetTerminalVisibility,
		onConsumeNotification,
		onLoadOlderHeartbeat,
	}: Props = $props();

	const stageMeta: Record<RuntimeTabId, { title: string }> = {
		heartbeat: {
			title: 'Heartbeat',
		},
		attention: {
			title: 'Attention',
		},
		settings: {
			title: 'Runtime settings',
		},
	};

	const currentMeta = $derived(stageMeta[tab]);
</script>

<Scaffold.Root class="rounded-xl border bg-card text-card-foreground shadow-sm" data-testid="runtime-primary-stage">
	<Scaffold.Header class="grid gap-3 border-b px-6 py-4">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="grid gap-1">
				<h2 class="text-base font-semibold">{currentMeta.title}</h2>
			</div>
			<Badge variant="outline">{resolveRuntimeStatusLabel(session.status)}</Badge>
		</div>
	</Scaffold.Header>

	<Scaffold.Body class="h-full p-4">
		{#if tab === 'heartbeat'}
			<RuntimeStageHeartbeat {messages} {requestAux} {modelCalls} {modelCallDeltas} onLoadOlder={onLoadOlderHeartbeat} />
		{:else if tab === 'attention'}
			<RuntimeStageAttention
				sessionId={session.id}
				{runtime}
				{channels}
				{notifications}
				{onOpenRoom}
				{onOpenTerminal}
				{onSetRoomVisibility}
				{onSetTerminalVisibility}
				{onConsumeNotification}
			/>
		{:else}
			<RuntimeStageSettings {session} {runtime} />
		{/if}
	</Scaffold.Body>
</Scaffold.Root>
