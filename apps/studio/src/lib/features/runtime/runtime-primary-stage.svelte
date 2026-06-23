<script lang="ts">
	import { Scaffold } from '@agenter/svelte-components';

	import type {
		CachedResourceState,
		HeartbeatGroupItem,
		MessageChannelEntry,
		ModelCallItem,
		RuntimeSnapshotEntry,
		RuntimeSchedulerState,
		SessionNotificationItem,
		SessionEntry,
	} from '@agenter/client-sdk';

	import type {
		RuntimeHeartbeatConfigBinding,
		RuntimeHeartbeatConfigDraft,
	} from './runtime-heartbeat-config-state';
	import RuntimeStageAttention from './runtime-stage-attention.svelte';
	import RuntimeStageHeartbeatEmbed from './runtime-stage-heartbeat-embed.svelte';
	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';
	import RuntimeStageSettings from './runtime-stage-settings.svelte';
	import type { RuntimeTabId } from './runtime-shell-state';

	interface Props {
		tab: RuntimeTabId;
		session: SessionEntry;
		runtime: RuntimeSnapshotEntry | null;
		channels: MessageChannelEntry[];
		notifications: SessionNotificationItem[];
		heartbeatGroups: CachedResourceState<HeartbeatGroupItem[]>;
		modelCalls: ModelCallItem[];
		heartbeatSchedulerState: RuntimeSchedulerState | null;
		heartbeatConfigBinding: RuntimeHeartbeatConfigBinding;
		heartbeatConfigLoading?: boolean;
		heartbeatConfigSaving?: boolean;
		heartbeatConfigError?: string | null;
		heartbeatCompactPending?: boolean;
		heartbeatCompactDisabled?: boolean;
		heartbeatRepairVersion?: number;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
		onOpenRoom: (chatId: string) => void | Promise<void>;
		onOpenTerminal: (terminalId: string) => void | Promise<void>;
		onSetRoomVisibility: (chatId: string, focused: boolean) => void | Promise<void>;
		onSetTerminalVisibility: (terminalId: string, focused: boolean) => void | Promise<void>;
		onConsumeNotification: (input: {
			chatId?: string;
			terminalId?: string;
			upToSrc?: string | null;
		}) => void | Promise<void>;
		onLoadOlderHeartbeat: () => Promise<{ items: number; hasMore: boolean }>;
		onRequestHeartbeatCompact: () => void | Promise<void>;
		onRefreshHeartbeatConfig: () => void | Promise<void>;
		onSaveHeartbeatConfig: (draft: RuntimeHeartbeatConfigDraft) => boolean | Promise<boolean>;
	}

	let {
		tab,
		session,
		runtime,
		channels,
		notifications,
		heartbeatGroups,
		modelCalls,
		heartbeatSchedulerState,
		heartbeatConfigBinding,
		heartbeatConfigLoading = false,
		heartbeatConfigSaving = false,
		heartbeatConfigError = null,
		heartbeatCompactPending = false,
		heartbeatCompactDisabled = false,
		heartbeatRepairVersion = 0,
		sessionIconUrl = null,
		avatarLabel = session.avatar || session.name,
		onOpenRoom,
		onOpenTerminal,
		onSetRoomVisibility,
		onSetTerminalVisibility,
		onConsumeNotification,
		onLoadOlderHeartbeat,
		onRequestHeartbeatCompact,
		onRefreshHeartbeatConfig,
		onSaveHeartbeatConfig,
	}: Props = $props();
</script>

<Scaffold.Root class="h-full" data-testid="runtime-primary-stage">
	<Scaffold.Body class="h-full">
		{#if tab === 'heartbeat'}
			{#if __LEGACY_WEB_HEARTBEAT_VIEW__}
				<RuntimeStageHeartbeat
					sessionStatus={session.status}
					schedulerState={heartbeatSchedulerState}
					groupsState={heartbeatGroups}
					modelCalls={modelCalls}
					attention={runtime?.attention ?? null}
					attentionDelivery={runtime?.attentionDelivery ?? null}
					compactPending={heartbeatCompactPending}
					compactDisabled={heartbeatCompactDisabled}
					onRequestCompact={onRequestHeartbeatCompact}
					configBinding={heartbeatConfigBinding}
					configLoading={heartbeatConfigLoading}
					configSaving={heartbeatConfigSaving}
					configError={heartbeatConfigError}
					{sessionIconUrl}
					{avatarLabel}
					onLoadOlder={onLoadOlderHeartbeat}
					onRefreshConfig={onRefreshHeartbeatConfig}
					onSaveConfig={onSaveHeartbeatConfig}
				/>
			{:else}
				<RuntimeStageHeartbeatEmbed sessionId={session.id} {avatarLabel} {heartbeatRepairVersion} />
			{/if}
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
			<RuntimeStageSettings {session} />
		{/if}
	</Scaffold.Body>
</Scaffold.Root>
