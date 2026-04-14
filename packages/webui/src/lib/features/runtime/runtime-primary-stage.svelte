<script lang="ts">
	import type {
		HeartbeatPartItem,
		MessageChannelEntry,
		ModelCallItem,
		RuntimeSnapshotEntry,
		SessionNotificationItem,
		SessionEntry,
	} from '@agenter/client-sdk';

	import RuntimeStageAttention from './runtime-stage-attention.svelte';
	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';
	import RuntimeStageSettings from './runtime-stage-settings.svelte';
	import type { RuntimeTabId } from './runtime-shell-state';

	interface Props {
		tab: RuntimeTabId;
		session: SessionEntry;
		runtime: RuntimeSnapshotEntry | null;
		channels: MessageChannelEntry[];
		notifications: SessionNotificationItem[];
		heartbeatEntries: HeartbeatPartItem[];
		modelCalls: ModelCallItem[];
		sessionIconUrl?: string | null;
		avatarLabel?: string;
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
		heartbeatEntries,
		modelCalls,
		sessionIconUrl = null,
		avatarLabel = session.avatar || session.name,
		onOpenRoom,
		onOpenTerminal,
		onSetRoomVisibility,
		onSetTerminalVisibility,
		onConsumeNotification,
		onLoadOlderHeartbeat,
	}: Props = $props();
</script>

<div class="h-full min-h-0" data-testid="runtime-primary-stage">
	{#if tab === 'heartbeat'}
		<RuntimeStageHeartbeat
			entries={heartbeatEntries}
			modelCalls={modelCalls}
			attention={runtime?.attention ?? null}
			{sessionIconUrl}
			{avatarLabel}
			onLoadOlder={onLoadOlderHeartbeat}
		/>
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
</div>
