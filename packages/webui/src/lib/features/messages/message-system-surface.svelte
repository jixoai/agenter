<script lang="ts">
	import {
		WebChatViewHost,
		type WebChatActorPresentation,
		type WebChatComposerCapabilities,
		type WebChatMessageAction,
		type WebChatMessageReadProgress,
		type WebChatMessageRenderInput,
	} from '@agenter/web-chat-view';
	import { tick, untrack } from 'svelte';

	import MessageRoomManageDialog from '$lib/features/messages/message-room-manage-dialog.svelte';
	import RoomAssetsPane from '$lib/features/messages/room-assets-pane.svelte';
	import RoomMessageSearchDialog from '$lib/features/messages/room-message-search-dialog.svelte';
	import RoomPageToolbarContent from '$lib/features/messages/room-page-toolbar-content.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';

	import type {
		MessageSystemManageSection,
		MessageSystemSurfaceProps,
	} from './message-system-surface.types';

	type RoomBodyMode = 'chat' | 'assets';

	let {
		selectedRoom,
		selectedRoomIconUrl = null,
		resolveProfileIconUrl,
		resolveSessionIconUrl,
		disableManageDialogPortal = false,
		initialManageDialogSection = null,
		initialMessages,
		initialSnapshotResolved,
		roomAssetsState,
		routeNotice,
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

	let surfaceRef = $state<HTMLElement | null>(null);
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
	let searchDialogOpen = $state(false);
	let searchQuery = $state('');
	let searchMatches = $state<string[]>([]);
	let searchMatchIndex = $state(0);

	const selectedRoomChatId = $derived(selectedRoom?.chatId ?? '');
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
			(canSelectViewer ? selectedViewerSeat?.label ?? 'Unset viewer' : 'No granted room user yet'),
	);
	const selectedViewerToolbarLabel = $derived.by(() => {
		const seat = selectedViewerSeat;
		if (!seat) {
			return canSelectViewer ? selectedViewerOptionLabel : 'No granted room user yet';
		}
		if (duplicateSeatLabels.has(seat.label)) {
			return selectedViewerOptionLabel;
		}
		return seat.label;
	});
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
	const searchMatchCount = $derived(searchMatches.length);
	const messageSearchSignature = $derived(
		initialMessages.map((message) => `${message.messageId}:${message.updatedAt ?? message.createdAt}`).join('|'),
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
		const trackedActorIds = [
			...(input.message.readActorIds ?? []),
			...(input.message.unreadActorIds ?? []),
		].filter((actorId) => !actorId.startsWith('system:'));
		const totalCount = trackedActorIds.length;
		if (totalCount === 0) {
			return null;
		}
		const readCount = (input.message.readActorIds ?? []).filter((actorId) => !actorId.startsWith('system:')).length;
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

	const clearSearchMarkers = (): void => {
		for (const row of surfaceRef?.querySelectorAll<HTMLElement>('[data-message-id][data-room-search-match]') ?? []) {
			row.removeAttribute('data-room-search-match');
		}
	};

	const findMessageRows = (): HTMLElement[] =>
		Array.from(surfaceRef?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []);

	const revealSearchMatch = async (): Promise<void> => {
		await tick();
		clearSearchMarkers();
		if (bodyMode !== 'chat' || searchMatches.length === 0) {
			return;
		}
		const activeMessageId = searchMatches[searchMatchIndex];
		if (!activeMessageId) {
			return;
		}
		const escapedMessageId =
			typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
				? CSS.escape(activeMessageId)
				: activeMessageId.replace(/["\\]/gu, '\\$&');
		const row = surfaceRef?.querySelector<HTMLElement>(`[data-message-id="${escapedMessageId}"]`);
		if (!row) {
			return;
		}
		row.dataset.roomSearchMatch = 'true';
		row.scrollIntoView({
			block: 'center',
			inline: 'nearest',
			behavior: 'smooth',
		});
	};

	const recomputeSearchMatches = async (): Promise<void> => {
		await tick();
		if (!searchDialogOpen || bodyMode !== 'chat') {
			searchMatches = [];
			searchMatchIndex = 0;
			clearSearchMarkers();
			return;
		}
		const needle = searchQuery.trim().toLocaleLowerCase();
		if (needle.length === 0) {
			searchMatches = [];
			searchMatchIndex = 0;
			clearSearchMarkers();
			return;
		}
		const matches = findMessageRows()
			.filter((row) => (row.textContent ?? '').toLocaleLowerCase().includes(needle))
			.map((row) => row.dataset.messageId ?? '')
			.filter(Boolean);
		searchMatches = matches;
		if (matches.length === 0) {
			searchMatchIndex = 0;
			clearSearchMarkers();
			return;
		}
		if (searchMatchIndex >= matches.length) {
			searchMatchIndex = 0;
		}
	};

	const navigateSearch = (direction: 1 | -1): void => {
		if (searchMatches.length === 0) {
			return;
		}
		searchMatchIndex = (searchMatchIndex + direction + searchMatches.length) % searchMatches.length;
	};

	$effect(() => {
		messageSearchSignature;
		searchDialogOpen;
		searchQuery;
		bodyMode;
		selectedRoomChatId;
		void recomputeSearchMatches();
	});

	$effect(() => {
		searchMatches.join('|');
		searchMatchIndex;
		bodyMode;
		void revealSearchMatch();
	});

</script>

<div bind:this={surfaceRef} class="message-system-surface">
	<WorkbenchPageToolbar>
		<WorkbenchToolbar class="room-toolbar">
			{#snippet content(toolbarState: WorkbenchToolbarRenderState)}
				<RoomPageToolbarContent
					{toolbarState}
					selectedViewer={selectedViewerSeat}
					{selectedViewerActorId}
					{viewerItems}
					selectedViewerLabel={selectedViewerToolbarLabel}
					{canSelectViewer}
					activeMode={bodyMode}
					canSearch={Boolean(selectedRoom)}
					onSelectViewer={onChangeViewerActorId}
					onSelectMode={(mode) => {
						bodyMode = mode;
						if (mode !== 'chat') {
							searchDialogOpen = false;
						}
					}}
					onSearchClick={() => {
						bodyMode = 'chat';
						searchDialogOpen = true;
					}}
					onAddUserClick={openManageAddUser}
					onManageClick={() => openManageDialog('overview')}
				/>
			{/snippet}
		</WorkbenchToolbar>
	</WorkbenchPageToolbar>

	<WorkbenchScaffold tone="page" bodyClass="h-full" data-testid="message-system-route">
		{#if bodyMode === 'assets'}
			<RoomAssetsPane state={roomAssetsState} />
		{:else}
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
		{/if}
	</WorkbenchScaffold>
</div>

<RoomMessageSearchDialog
	bind:open={searchDialogOpen}
	query={searchQuery}
	matchCount={searchMatchCount}
	activeIndex={searchMatchIndex}
	onQueryChange={(value) => {
		searchQuery = value;
		searchMatchIndex = 0;
	}}
	onPrevious={() => navigateSearch(-1)}
	onNext={() => navigateSearch(1)}
/>

<MessageRoomManageDialog
	open={manageDialogOpen}
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

	:global([data-message-id][data-room-search-match='true']) {
		border-radius: 1.1rem;
		outline: 2px solid color-mix(in srgb, var(--foreground), transparent 78%);
		outline-offset: 0.2rem;
		background: color-mix(in srgb, var(--foreground), transparent 96%);
	}
</style>
