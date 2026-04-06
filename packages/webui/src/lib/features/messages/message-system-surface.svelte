<script lang="ts">
	import UserRoundIcon from '@lucide/svelte/icons/user-round';
	import UsersIcon from '@lucide/svelte/icons/users';
	import {
		WebChatViewHost,
		type WebChatActorPresentation,
		type WebChatComposerCapabilities,
		type WebChatMessageAction,
		type WebChatMessageReadProgress,
		type WebChatMessageRenderInput,
	} from '@agenter/web-chat-view';
	import { untrack } from 'svelte';

	import MessageRoomManageDialog from '$lib/features/messages/message-room-manage-dialog.svelte';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';

	import type {
		MessageSystemManageSection,
		MessageSystemSurfaceProps,
	} from './message-system-surface.types';

	let {
		selectedRoom,
		selectedRoomIconUrl = null,
		resolveProfileIconUrl,
		resolveSessionIconUrl,
		disableManageDialogPortal = false,
		initialManageDialogSection = null,
		initialMessages,
		initialSnapshotResolved,
		routeNotice,
		readSeatCount,
		readSeatTotal,
		selectedCallerToken,
		selectedViewerActorId,
		selectableActors,
		roomSeatStates,
		onChangeViewerActorId,
		onSaveRoomTitle,
		onArchiveRoom,
		onDeleteRoom,
		onGrantSeat,
		onToggleSeatFocus,
		onRevokeSeat,
		onSendMessage,
		onLatestVisibleMessageIdChange,
	}: MessageSystemSurfaceProps = $props();

	let editableTitlesByRoomId: Record<string, string> = $state({});
	let manageDialogOpen = $state(untrack(() => initialManageDialogSection !== null));
	let manageSection = $state<MessageSystemManageSection>(
		untrack(() => initialManageDialogSection ?? 'overview'),
	);
	let grantParticipantIdsByRoomId: Record<string, string> = $state({});
	let grantRole: 'admin' | 'member' | 'readonly' = $state('member');
	let grantBusy = $state(false);
	let grantErrorsByRoomId: Record<string, string | null> = $state({});
	let titleBusy = $state(false);
	let archiveBusy = $state(false);
	let deleteBusy = $state(false);

	const selectedRoomChatId = $derived(selectedRoom?.chatId ?? '');
	const visibleParticipantCount = (room: MessageSystemSurfaceProps['selectedRoom']): number =>
		room?.participants.filter((participant) => !participant.id.startsWith('system:')).length ?? 0;
	const editableTitle = $derived(
		selectedRoomChatId ? (editableTitlesByRoomId[selectedRoomChatId] ?? selectedRoom?.title ?? '') : '',
	);
	const grantParticipantId = $derived(
		selectedRoomChatId ? (grantParticipantIdsByRoomId[selectedRoomChatId] ?? '') : '',
	);
	const grantError = $derived(selectedRoomChatId ? (grantErrorsByRoomId[selectedRoomChatId] ?? null) : null);
	const roomUserCount = $derived(
		selectedRoom ? Math.max(visibleParticipantCount(selectedRoom), roomSeatStates.length) : 0,
	);
	const selectedViewerLabel = $derived(
		roomSeatStates.find((seat) => seat.actorId === selectedViewerActorId)?.label ?? 'Unset viewer',
	);
	const canSelectViewer = $derived(roomSeatStates.length > 0);
	const canSendForViewer = $derived(Boolean(selectedCallerToken));
	const duplicateSeatLabels = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const state of roomSeatStates) {
			counts.set(state.label, (counts.get(state.label) ?? 0) + 1);
		}
		return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([label]) => label));
	});
	const viewerItems = $derived(
		roomSeatStates.map((state) => ({
			value: state.actorId,
			label: describeSeatOption(state),
		})),
	);
	const selectedViewerOptionLabel = $derived(
		viewerItems.find((item) => item.value === selectedViewerActorId)?.label ??
			(canSelectViewer ? selectedViewerLabel : 'No granted room user yet'),
	);
	const roomSeatMap = $derived(new Map(roomSeatStates.map((state) => [state.actorId, state])));
	const channelPresentation = $derived(
		selectedRoom
			? ({
					label: selectedRoom.title ?? 'Room transcript',
					subtitle: selectedRoom.chatId,
					iconUrl: selectedRoomIconUrl,
					kind: 'room',
				} satisfies WebChatActorPresentation)
			: null,
	);
	const composerCapabilities = $derived(
		({
			attachmentEnabled: true,
			imageEnabled: true,
			screenshotEnabled: true,
			mentionSuggestions: roomSeatStates.map((state) => ({
				id: state.actorId,
				label: state.label,
				detail: `${state.role}${state.currentAdmin ? ' · current admin' : ''}`,
				apply: `@${state.label.replace(/\s+/gu, '-')}`,
				iconUrl: state.iconUrl,
			})),
		} satisfies WebChatComposerCapabilities),
	);

	const resolveActorPresentation = (input: {
		channel: NonNullable<MessageSystemSurfaceProps['selectedRoom']>;
		message?: MessageSystemSurfaceProps['initialMessages'][number];
		viewerActorId: string | null;
		role: 'assistant' | 'channel' | 'participant' | 'viewer';
		actorId?: string | null;
		fallbackLabel: string;
	}): WebChatActorPresentation | null => {
		const fallbackIconUrl = (() => {
			if (input.actorId?.startsWith('session:')) {
				return resolveSessionIconUrl?.(input.actorId.slice('session:'.length)) ?? null;
			}
			const iconReference = input.actorId ?? input.fallbackLabel;
			return iconReference ? (resolveProfileIconUrl?.(iconReference) ?? null) : null;
		})();

		if (input.role === 'assistant') {
			return {
				actorId: input.actorId ?? null,
				label: input.fallbackLabel,
				subtitle: selectedRoom?.chatId,
				iconUrl: selectedRoomIconUrl,
				kind: 'assistant',
			};
		}
		if (input.actorId && roomSeatMap.has(input.actorId)) {
			const seat = roomSeatMap.get(input.actorId)!;
			return {
				actorId: seat.actorId,
				label: seat.label,
				subtitle: seat.subtitle ?? `${seat.role}${seat.currentAdmin ? ' · current admin' : ''}`,
				iconUrl: seat.iconUrl ?? fallbackIconUrl,
				kind: seat.actorKind === 'auth' ? 'auth' : seat.actorKind === 'session' ? 'session' : 'system',
			};
		}
		return {
			actorId: input.actorId ?? null,
			label: input.fallbackLabel,
			subtitle: input.actorId ?? undefined,
			iconUrl: fallbackIconUrl,
			kind: input.role === 'channel' ? 'room' : input.role,
		};
	};

	const resolveMessageActions = (input: WebChatMessageRenderInput): readonly WebChatMessageAction[] => {
		if (!input.message.senderActorId) {
			return [];
		}
		return [
			{
				id: 'copy-actor-id',
				label: 'Copy actor id',
				detail: 'actor',
				onSelect: async () => {
					if (navigator.clipboard?.writeText) {
						await navigator.clipboard.writeText(input.message.senderActorId ?? '');
					}
				},
			},
		];
	};

	const resolveMessageReadProgress = (input: WebChatMessageRenderInput): WebChatMessageReadProgress | null => {
		const relevantSeats = roomSeatStates.filter((seat) => seat.actorKind !== 'system');
		if (relevantSeats.length === 0) {
			return null;
		}
		const readCount = relevantSeats.filter((seat) => (seat.readMessageRowId ?? -1) >= input.message.rowId).length;
		const totalCount = relevantSeats.length;
		return {
			readCount,
			totalCount,
			title:
				readCount >= totalCount
					? `All ${totalCount} users read`
					: `${readCount}/${totalCount} read`,
		};
	};

	const openManageDialog = (section: MessageSystemManageSection = 'overview'): void => {
		manageSection = section;
		manageDialogOpen = true;
	};

	const formatTimestamp = (value?: number): string => {
		if (!value) {
			return 'unknown';
		}
		return new Date(value).toLocaleString();
	};

	const describeSeatOption = (state: MessageSystemSurfaceProps['roomSeatStates'][number]): string => {
		if (!duplicateSeatLabels.has(state.label)) {
			return `${state.label} · ${state.role}`;
		}
		return `${state.label} · ${state.subtitle ?? state.actorId} · ${state.role}`;
	};

	const setEditableTitle = (value: string): void => {
		if (!selectedRoomChatId) {
			return;
		}
		editableTitlesByRoomId = {
			...editableTitlesByRoomId,
			[selectedRoomChatId]: value,
		};
	};

	const setGrantParticipantId = (value: string): void => {
		if (!selectedRoomChatId) {
			return;
		}
		grantParticipantIdsByRoomId = {
			...grantParticipantIdsByRoomId,
			[selectedRoomChatId]: value,
		};
	};

	const setGrantError = (value: string | null): void => {
		if (!selectedRoomChatId) {
			return;
		}
		grantErrorsByRoomId = {
			...grantErrorsByRoomId,
			[selectedRoomChatId]: value,
		};
	};

	const handleSaveTitle = async (): Promise<void> => {
		if (!selectedRoom || titleBusy) {
			return;
		}
		const title = editableTitle.trim();
		if (title.length === 0) {
			return;
		}
		titleBusy = true;
		try {
			await onSaveRoomTitle(title);
		} finally {
			titleBusy = false;
		}
	};

	const handleArchive = async (): Promise<void> => {
		if (!selectedRoom || archiveBusy) {
			return;
		}
		archiveBusy = true;
		try {
			await onArchiveRoom();
		} finally {
			archiveBusy = false;
		}
	};

	const handleDelete = async (): Promise<void> => {
		if (!selectedRoom || deleteBusy) {
			return;
		}
		deleteBusy = true;
		try {
			await onDeleteRoom();
		} finally {
			deleteBusy = false;
		}
	};

	const handleGrantSeat = async (): Promise<void> => {
		if (!selectedRoom || grantBusy || grantParticipantId.length === 0) {
			return;
		}
		grantBusy = true;
		setGrantError(null);
		try {
			await onGrantSeat({
				participantId: grantParticipantId,
				role: grantRole,
			});
			setGrantParticipantId('');
		} catch (error) {
			setGrantError(error instanceof Error ? error.message : String(error));
		} finally {
			grantBusy = false;
		}
	};

	const handleSeatFocusClick = (state: MessageSystemSurfaceProps['roomSeatStates'][number]): void => {
		if (!state.accessToken) {
			return;
		}
		void onToggleSeatFocus({
			actorId: state.actorId,
			accessToken: state.accessToken,
			focused: state.focused,
		});
	};

	const handleSeatRevokeClick = (state: MessageSystemSurfaceProps['roomSeatStates'][number]): void => {
		if (!state.grantId) {
			return;
		}
		void onRevokeSeat({
			actorId: state.actorId,
			grantId: state.grantId,
		});
	};
</script>

<WorkbenchPageToolbar>
	<WorkbenchToolbar class="room-toolbar">
		{#snippet navigation()}
			<ProfileAvatar
				label={selectedRoom?.title ?? selectedRoom?.chatId ?? 'Room'}
				src={selectedRoomIconUrl}
				class="size-10 rounded-2xl border border-border/70 bg-background/80 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_80%)]"
			/>
		{/snippet}

		{#snippet primary()}
			<div class="grid min-w-0 gap-1">
				<span class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Room</span>
				<h1 class="truncate text-[1.02rem] font-semibold tracking-tight text-foreground">
					{selectedRoom?.title ?? selectedRoom?.chatId ?? 'Room transcript'}
				</h1>
			</div>
		{/snippet}

		{#snippet actions()}
			<Button
				variant="outline"
				size="sm"
				class="h-8 w-auto rounded-full border-border/70 bg-background/80 px-3.5 text-[0.82rem] shadow-none"
				disabled={!selectedRoom}
				onclick={() => openManageDialog('overview')}
			>
				Manage room
			</Button>
		{/snippet}

		{#snippet meta()}
			<div class="room-toolbar__meta">
				{#if selectedRoom}
					<span class="room-toolbar__chip room-toolbar__chip-muted">{selectedRoom.chatId}</span>
					<span class="room-toolbar__chip">
						<UsersIcon class="size-3.5" />
						<span>{roomUserCount} {roomUserCount === 1 ? 'user' : 'users'}</span>
					</span>
					{#if !selectedCallerToken}
						<span class="room-toolbar__chip room-toolbar__chip-warning">Read-only</span>
						<Button
							variant="link"
							size="sm"
							class="h-auto px-0 text-[0.78rem]"
							onclick={() => openManageDialog('access')}
						>
							Grant access
						</Button>
					{/if}
				{/if}

				<div class="room-toolbar__viewer">
					<div class="room-toolbar__viewer-label">
						<UserRoundIcon class="size-3.5" />
						<span>View as</span>
					</div>
					<Select.Root
						type="single"
						items={viewerItems}
						value={selectedViewerActorId ?? undefined}
						disabled={!canSelectViewer}
						onValueChange={(value) => {
							onChangeViewerActorId(value);
						}}
					>
						<Select.Trigger
							aria-label="View room as user"
							class="h-8 w-full min-w-0 max-w-full rounded-full border-border/70 bg-background/85 px-3 text-[0.82rem] font-medium shadow-none"
						>
							<span class="truncate">As · {selectedViewerOptionLabel}</span>
						</Select.Trigger>
						<Select.Content>
							{#each viewerItems as item (item.value)}
								<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
		{/snippet}
	</WorkbenchToolbar>
</WorkbenchPageToolbar>

<div class="h-full" data-testid="message-system-route">
	<WebChatViewHost
		channel={selectedRoom}
		viewerActorId={selectedViewerActorId}
		{initialMessages}
		{initialSnapshotResolved}
		class="h-full"
		disabled={!selectedRoom || !canSendForViewer}
		showHeader={false}
		emptyTitle="No room selected"
		emptyMessage="Open or create a room tab to begin."
		emptyTranscriptTitle="No room facts yet"
		emptyTranscriptMessage="Send the first message to begin this room."
		{routeNotice}
		{channelPresentation}
		{resolveActorPresentation}
		{resolveMessageActions}
		{resolveMessageReadProgress}
		{composerCapabilities}
		onSendMessage={onSendMessage}
		onLatestVisibleMessageIdChange={onLatestVisibleMessageIdChange}
	/>
</div>

<MessageRoomManageDialog
	open={manageDialogOpen}
	bind:section={manageSection}
	{selectedRoom}
	{disableManageDialogPortal}
	{editableTitle}
	{titleBusy}
	{archiveBusy}
	{deleteBusy}
	{readSeatCount}
	{readSeatTotal}
	visibleParticipantCount={visibleParticipantCount(selectedRoom)}
	{roomSeatStates}
	{selectedViewerLabel}
	{selectableActors}
	{grantParticipantId}
	{grantRole}
	{grantBusy}
	{grantError}
	{formatTimestamp}
	onEditableTitleChange={setEditableTitle}
	onSaveTitle={handleSaveTitle}
	onArchive={handleArchive}
	onDelete={handleDelete}
	onNavigateToAccess={() => {
		manageSection = 'access';
	}}
	onSeatFocusClick={handleSeatFocusClick}
	onSeatRevokeClick={handleSeatRevokeClick}
	onGrantParticipantIdChange={setGrantParticipantId}
	onGrantRoleChange={(value) => {
		grantRole = value;
	}}
	onGrantSeat={handleGrantSeat}
/>

<style>
	.room-toolbar__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 0.75rem;
	}

	.room-toolbar__chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--border), transparent 26%);
		background: color-mix(in srgb, var(--background), transparent 12%);
		padding: 0.34rem 0.7rem;
		font-size: 0.74rem;
		font-weight: 500;
		line-height: 1;
		color: var(--foreground);
	}

	.room-toolbar__chip-muted {
		color: var(--muted-foreground);
	}

	.room-toolbar__chip-warning {
		border-color: color-mix(in srgb, #f59e0b, transparent 24%);
		background: color-mix(in srgb, #f59e0b, white 88%);
		color: #b45309;
	}

	.room-toolbar__viewer {
		display: grid;
		gap: 0.45rem;
		min-width: min(100%, 16rem);
		margin-left: auto;
	}

	.room-toolbar__viewer-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	@container (max-width: 44rem) {
		.room-toolbar__viewer {
			margin-left: 0;
			inline-size: 100%;
		}
	}
</style>
