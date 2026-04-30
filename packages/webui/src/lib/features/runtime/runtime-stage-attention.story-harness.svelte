<script lang="ts">
	import type {
		MessageChannelEntry,
		RuntimeSnapshotEntry,
		SessionNotificationItem,
	} from '@agenter/client-sdk';

	import { cn } from '$lib/utils.js';

	import RuntimeStageAttention from './runtime-stage-attention.svelte';

	let {
		sessionId = 'session-attention',
		frameClass = 'h-[58rem] w-[72rem] max-w-none',
		runtime,
		channels,
		notifications,
	}: {
		sessionId?: string;
		frameClass?: string;
		runtime: RuntimeSnapshotEntry | null;
		channels: MessageChannelEntry[];
		notifications: SessionNotificationItem[];
	} = $props();

	let roomVisibilityUpdates = $state<Array<{ chatId: string; focused: boolean }>>([]);
	let terminalVisibilityUpdates = $state<Array<{ terminalId: string; focused: boolean }>>([]);
	let consumedNotifications = $state<Array<{ chatId?: string; terminalId?: string; upToSrc?: string | null }>>([]);
	let openedRooms = $state<string[]>([]);
	let openedTerminals = $state<string[]>([]);
</script>

<div
	class={cn('grid rounded-[1.35rem] border border-border/70 bg-background p-4', frameClass)}
	data-testid="runtime-attention-story"
>
	<div class="sr-only" data-testid="runtime-attention-opened-rooms">{openedRooms.join(',')}</div>
	<div class="sr-only" data-testid="runtime-attention-opened-terminals">{openedTerminals.join(',')}</div>
	<div class="sr-only" data-testid="runtime-attention-room-visibility">
		{roomVisibilityUpdates.map((entry) => `${entry.chatId}:${entry.focused ? 'focused' : 'background'}`).join(',')}
	</div>
	<div class="sr-only" data-testid="runtime-attention-terminal-visibility">
		{terminalVisibilityUpdates
			.map((entry) => `${entry.terminalId}:${entry.focused ? 'focused' : 'background'}`)
			.join(',')}
	</div>
	<div class="sr-only" data-testid="runtime-attention-consumed-notifications">
		{consumedNotifications
			.map((entry) => `${entry.chatId ?? entry.terminalId ?? 'unknown'}:${entry.upToSrc ?? ''}`)
			.join(',')}
	</div>
	<RuntimeStageAttention
		{sessionId}
		{runtime}
		{channels}
		{notifications}
		onOpenRoom={async (chatId) => {
			openedRooms = [...openedRooms, chatId];
		}}
		onOpenTerminal={async (terminalId) => {
			openedTerminals = [...openedTerminals, terminalId];
		}}
		onSetRoomVisibility={async (chatId, focused) => {
			roomVisibilityUpdates = [...roomVisibilityUpdates, { chatId, focused }];
		}}
		onSetTerminalVisibility={async (terminalId, focused) => {
			terminalVisibilityUpdates = [...terminalVisibilityUpdates, { terminalId, focused }];
		}}
		onConsumeNotification={async (input) => {
			consumedNotifications = [...consumedNotifications, input];
		}}
	/>
</div>
