<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { untrack, type ComponentProps } from 'svelte';

	import MessageRoomManageDialog from '$lib/features/messages/message-room-manage-dialog.svelte';
	import RoomAssetsPane from '$lib/features/messages/room-assets-pane.svelte';
	import RoomPageToolbarContent from '$lib/features/messages/room-page-toolbar-content.svelte';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';

	import { buildMessageAppViewRoomUrl } from './message-app-view-url';
	import type {
		MessageSystemManageSection,
		MessageSystemSurfaceProps,
	} from './message-system-surface.types';

	type RoomBodyMode = 'chat' | 'assets';

	const DEFAULT_DEV_APP_VIEW_URL = 'http://127.0.0.1:4292/';

	let {
		selectedRoom,
		authenticated,
		archivedRoomCount = 0,
		roomSeatTruthLoaded = true,
		disableManageDialogPortal = false,
		initialManageDialogSection = null,
		roomAssetsState,
		routeNotice,
		selectedCallerToken,
		selectedViewerAccessToken,
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
	}: MessageSystemSurfaceProps = $props();

	let editableTitlesByRoomId: Record<string, string> = $state({});
	let manageDialogOpen = $state(untrack(() => initialManageDialogSection !== null));
	let manageSection = $state<MessageSystemManageSection>(
		untrack(() => initialManageDialogSection ?? 'overview'),
	);
	let manageUsersView = $state<'list' | 'add'>('list');
	let grantParticipantIdsByRoomId: Record<string, string> = $state({});
	let grantRole: 'admin' | 'member' | 'readonly' = $state('member');
	let grantBusy = $state(false);
	let grantErrorsByRoomId: Record<string, string | null> = $state({});
	let titleBusy = $state(false);
	let archiveBusy = $state(false);
	let deleteBusy = $state(false);
	let bodyMode = $state<RoomBodyMode>('chat');

	const selectedRoomChatId = $derived(selectedRoom?.chatId ?? '');
	const roomArchived = $derived(Boolean(selectedRoom?.archivedAt));
	const appViewBaseUrl = $derived(
		env.PUBLIC_WEB_CHAT_VIEW_APP_VIEW_URL?.trim() || (import.meta.env.DEV ? DEFAULT_DEV_APP_VIEW_URL : ''),
	);
	const roomAppViewUrl = $derived(
		buildMessageAppViewRoomUrl({
			appViewBaseUrl,
			room: selectedRoom,
			viewerContactId: selectedViewerActorId,
			viewerAccessToken: selectedViewerAccessToken,
		}),
	);
	const appViewFrameTitle = $derived(
		selectedRoom?.title ? `${selectedRoom.title} app-view` : 'Web Chat app-view',
	);
	const editableTitle = $derived(
		selectedRoomChatId ? (editableTitlesByRoomId[selectedRoomChatId] ?? selectedRoom?.title ?? '') : '',
	);
	const grantParticipantId = $derived(
		selectedRoomChatId ? (grantParticipantIdsByRoomId[selectedRoomChatId] ?? '') : '',
	);
	const grantError = $derived(selectedRoomChatId ? (grantErrorsByRoomId[selectedRoomChatId] ?? null) : null);
	const selectedViewerSeat = $derived(
		roomSeatStates.find((seat) => seat.actorId === selectedViewerActorId) ?? null,
	);
	const canSelectViewer = $derived(authenticated && roomSeatStates.length > 0);
	const canSendForViewer = $derived(authenticated && Boolean(selectedCallerToken));
	const roomSendCapabilityLabel = $derived.by(() => {
		if (!authenticated) {
			return 'Sign in to manage or send.';
		}
		if (!roomSeatTruthLoaded) {
			return 'Loading room users…';
		}
		if (!selectedViewerSeat) {
			return 'No sending seat';
		}
		if (!canSendForViewer) {
			return selectedViewerSeat.role === 'readonly' ? 'Read-only seat selected' : 'Sending unavailable';
		}
		return null;
	});
	const roomSendCapabilityDetail = $derived.by(() => {
		if (!authenticated) {
			return 'Room transcript and controls require an authenticated superadmin session.';
		}
		if (!roomSeatTruthLoaded) {
			return 'Waiting for durable room grants before exposing participant send controls.';
		}
		if (!selectedViewerSeat) {
			return 'Transcript read and room management stay available, but sending requires a member or admin seat.';
		}
		if (!canSendForViewer) {
			return selectedViewerSeat.role === 'readonly'
				? 'Readonly room users can inspect transcript state but cannot send chat messages.'
				: 'This room user does not currently expose a valid send token.';
		}
		return null;
	});
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
			subtitle: state.subtitle ?? state.actorId,
			iconUrl: state.iconUrl,
		})),
	);
	const selectedViewerOptionLabel = $derived(
		viewerItems.find((item) => item.value === selectedViewerActorId)?.label ??
			(canSelectViewer ? selectedViewerSeat?.label ?? 'Unset viewer' : roomSendCapabilityLabel ?? 'No sending seat'),
	);
	const selectedViewerToolbarLabel = $derived.by(() => {
		const seat = selectedViewerSeat;
		if (!seat) {
			return canSelectViewer ? selectedViewerOptionLabel : roomSendCapabilityLabel ?? 'No sending seat';
		}
		if (duplicateSeatLabels.has(seat.label)) {
			return selectedViewerOptionLabel;
		}
		return seat.label;
	});
	const selectedViewerToolbarSubtitle = $derived.by(() => {
		const seat = selectedViewerSeat;
		if (!seat) {
			return canSelectViewer
				? 'Choose the active room user.'
				: roomSendCapabilityDetail ?? 'Transcript read and room management remain available.';
		}
		return [seat.role, seat.currentAdmin ? 'current admin' : null].filter(Boolean).join(' · ');
	});
	const roomToolbarProps = $derived.by(
		() =>
			({
				selectedViewer: selectedViewerSeat,
				selectedViewerActorId,
				viewerItems,
				selectedViewerLabel: selectedViewerToolbarLabel,
				selectedViewerSubtitle: selectedViewerToolbarSubtitle,
				canSelectViewer,
				activeMode: bodyMode,
				canSearch: false,
				actionsDisabled: !authenticated,
				onSelectViewer: onChangeViewerActorId,
				onSelectMode: (mode: RoomBodyMode) => {
					bodyMode = mode;
				},
				onSearchClick: () => undefined,
				onAddUserClick: openManageAddUser,
				onManageClick: () => openManageDialog('overview'),
			}) satisfies ComponentProps<typeof RoomPageToolbarContent>,
	);

	const openManageDialog = (section: MessageSystemManageSection = 'overview'): void => {
		manageSection = section;
		if (section === 'users') {
			manageUsersView = 'list';
		}
		manageDialogOpen = true;
	};

	const openManageAddUser = (): void => {
		manageSection = 'users';
		manageUsersView = 'add';
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

	const handleUpdateSeatRole = async (input: {
		participantId: string;
		role: 'admin' | 'member' | 'readonly';
	}): Promise<void> => {
		if (!selectedRoom) {
			return;
		}
		await onGrantSeat(input);
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

<div class="message-system-surface">
	{#if selectedRoom}
		<WorkbenchPageToolbar>
			<RoomPageToolbarContent {...roomToolbarProps} />
		</WorkbenchPageToolbar>
	{/if}

	<WorkbenchScaffold tone="page" bodyClass="h-full" data-testid="message-system-route">
		{#if roomArchived && selectedRoom}
			<div
				class="mx-4 mt-4 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-sm text-muted-foreground"
				data-testid="message-room-archived-banner"
			>
				<div class="font-medium text-foreground">This room is archived.</div>
				<div class="mt-1">
					It no longer appears in the default active list, but the transcript and room detail remain available here.
					{#if archivedRoomCount > 0}
						<span> Open the Archive tab to review other archived rooms.</span>
					{/if}
				</div>
			</div>
		{/if}
		{#if roomSendCapabilityLabel && roomSendCapabilityDetail}
			<div
				class="mx-4 mt-4 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground"
				data-testid="message-room-send-capability-banner"
			>
				<div class="font-medium text-foreground">{roomSendCapabilityLabel}</div>
				<div class="mt-1">{roomSendCapabilityDetail}</div>
			</div>
		{/if}
		{#if routeNotice}
			<div
				class="mx-4 mt-4 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground"
				data-testid="message-room-route-notice"
			>
				<div class="font-medium text-foreground">Room notice</div>
				<div class="mt-1">{routeNotice.message}</div>
			</div>
		{/if}
		{#if bodyMode === 'assets'}
			<RoomAssetsPane state={roomAssetsState} />
		{:else if roomAppViewUrl}
			<div class="message-system-surface__app-view" data-testid="message-room-app-view">
					<iframe
						class="message-system-surface__app-view-frame"
						data-testid="message-room-app-view-frame"
						title={appViewFrameTitle}
						src={roomAppViewUrl}
						allow="clipboard-read; clipboard-write"
					></iframe>
			</div>
		{:else}
			<div class="message-system-surface__app-view-empty" data-testid="message-room-app-view-unavailable">
				<div class="text-sm font-semibold text-foreground">Web Chat app-view is unavailable.</div>
				<div class="mt-1 text-xs text-muted-foreground">
					Select a room user with a valid access token and make sure `PUBLIC_WEB_CHAT_VIEW_APP_VIEW_URL` points to the app-view host.
				</div>
			</div>
		{/if}
	</WorkbenchScaffold>
</div>

<MessageRoomManageDialog
	bind:open={manageDialogOpen}
	bind:section={manageSection}
	bind:usersView={manageUsersView}
	{selectedRoom}
	{disableManageDialogPortal}
	{editableTitle}
	{titleBusy}
	{archiveBusy}
	{deleteBusy}
	{roomSeatStates}
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
	onNavigateToUsers={() => {
		manageSection = 'users';
		manageUsersView = 'list';
	}}
	onUpdateSeatRole={handleUpdateSeatRole}
	onSeatFocusClick={handleSeatFocusClick}
	onSeatRevokeClick={handleSeatRevokeClick}
	onGrantParticipantIdChange={setGrantParticipantId}
	onGrantRoleChange={(value) => {
		grantRole = value;
	}}
	onGrantSeat={handleGrantSeat}
/>

<style>
	.message-system-surface {
		block-size: 100%;
		min-block-size: 0;
	}

	.message-system-surface__app-view {
		block-size: 100%;
		min-block-size: 0;
	}

	.message-system-surface__app-view-frame {
		display: block;
		inline-size: 100%;
		block-size: 100%;
		border: 0;
		background: transparent;
	}

	.message-system-surface__app-view-empty {
		margin: 1rem;
		border: 1px solid color-mix(in srgb, var(--border), transparent 30%);
		border-radius: 1rem;
		padding: 1rem;
		background: color-mix(in srgb, var(--background), white 10%);
	}
</style>
