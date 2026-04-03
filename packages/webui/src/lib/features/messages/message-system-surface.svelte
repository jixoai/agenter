<script lang="ts">
	import MailPlusIcon from '@lucide/svelte/icons/mail-plus';
	import { WebChatViewHost } from '@agenter/web-chat-view';
	import { untrack } from 'svelte';

	import MessageRoomManageDialog from '$lib/features/messages/message-room-manage-dialog.svelte';
	import PanelShell from '$lib/components/panel-shell.svelte';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import ScrollView from '$lib/components/scroll-view.svelte';
	import StatusRing from '$lib/components/status-ring.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';

	import type {
		MessageSystemManageSection,
		MessageSystemSurfaceProps,
	} from './message-system-surface.types';

	let {
		roomsState,
		selectedRoomId,
		selectedRoom,
		disableManageDialogPortal = false,
		initialManageDialogSection = null,
		initialMessages,
		initialSnapshotResolved,
		routeNotice,
		readSeatCount,
		readSeatTotal,
		sendAsOptions,
		selectedCallerToken,
		selectedViewerActorId,
		selectableActors,
		roomSeatStates,
		onSelectRoom,
		onChangeCallerToken,
		onChangeViewerActorId,
		onSaveRoomTitle,
		onArchiveRoom,
		onDeleteRoom,
		onCreateRoom,
		onGrantSeat,
		onToggleSeatFocus,
		onRevokeSeat,
		onSendMessage,
		onLatestVisibleMessageIdChange,
	}: MessageSystemSurfaceProps = $props();

	let editableTitlesByRoomId: Record<string, string> = $state({});
	let createDialogOpen = $state(false);
	let manageDialogOpen = $state(untrack(() => initialManageDialogSection !== null));
	let manageSection = $state<MessageSystemManageSection>(
		untrack(() => initialManageDialogSection ?? 'overview'),
	);
	let createTitle = $state('');
	let createSelection: Record<string, boolean> = $state({});
	let createBusy = $state(false);
	let createError: string | null = $state(null);
	let grantParticipantIdsByRoomId: Record<string, string> = $state({});
	let grantRole: 'admin' | 'member' | 'readonly' = $state('member');
	let grantBusy = $state(false);
	let grantErrorsByRoomId: Record<string, string | null> = $state({});
	let titleBusy = $state(false);
	let archiveBusy = $state(false);
	let deleteBusy = $state(false);

	const selectedRoomChatId = $derived(selectedRoom?.chatId ?? '');
	const roomCount = $derived(roomsState.data.length);
	const editableTitle = $derived(
		selectedRoomChatId ? (editableTitlesByRoomId[selectedRoomChatId] ?? selectedRoom?.title ?? '') : '',
	);
	const grantParticipantId = $derived(
		selectedRoomChatId ? (grantParticipantIdsByRoomId[selectedRoomChatId] ?? '') : '',
	);
	const grantError = $derived(selectedRoomChatId ? (grantErrorsByRoomId[selectedRoomChatId] ?? null) : null);
	const selectedViewerLabel = $derived(
		roomSeatStates.find((seat) => seat.actorId === selectedViewerActorId)?.label ?? 'Unset viewer',
	);
	const duplicateSeatLabels = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const state of roomSeatStates) {
			counts.set(state.label, (counts.get(state.label) ?? 0) + 1);
		}
		return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([label]) => label));
	});
	const duplicateSendAsLabels = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const option of sendAsOptions) {
			counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
		}
		return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([label]) => label));
	});

	const resetCreateDialog = (): void => {
		createTitle = '';
		createSelection = {};
		createError = null;
	};

	const openCreateDialog = (): void => {
		resetCreateDialog();
		createDialogOpen = true;
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

	const describeSendAsOption = (option: MessageSystemSurfaceProps['sendAsOptions'][number]): string => {
		if (!duplicateSendAsLabels.has(option.label)) {
			return `${option.label} · ${option.role}`;
		}
		return `${option.label} · ${option.participantId ?? option.accessToken} · ${option.role}`;
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

	const handleCreateRoomSubmit = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		if (createBusy) {
			return;
		}
		createBusy = true;
		createError = null;
		try {
			const participantIds = Object.entries(createSelection)
				.filter(([, checked]) => checked)
				.map(([actorId]) => actorId);
			await onCreateRoom({
				title: createTitle.trim() || undefined,
				participantIds,
			});
			createDialogOpen = false;
			resetCreateDialog();
		} catch (error) {
			createError = error instanceof Error ? error.message : String(error);
		} finally {
			createBusy = false;
		}
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

<div class="grid h-full gap-4 p-4 md:grid-cols-[18rem_minmax(0,1fr)] md:p-6">
	<PanelShell>
		{#snippet header()}
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<h1 class="text-base font-semibold">Rooms</h1>
					<p class="text-sm text-muted-foreground">
						message-system lists standalone rooms, not workspace-owned session chats.
					</p>
				</div>
				<Button
					size="icon-sm"
					variant="outline"
					class="shrink-0"
					onclick={openCreateDialog}
					aria-label="Open create room dialog"
				>
					<MailPlusIcon class="size-4" />
				</Button>
			</div>
		{/snippet}

		<ScrollView class="h-full" contentClass="divide-y">
			{#if roomsState.loading && !roomsState.loaded}
				<div class="p-4 text-sm text-muted-foreground">Loading rooms…</div>
			{:else if roomsState.error && roomCount === 0}
				<div class="p-4 text-sm text-destructive">{roomsState.error}</div>
			{:else if roomCount === 0}
				<div class="p-4 text-sm text-muted-foreground">No rooms yet. Create the first standalone room.</div>
			{:else}
				{#each roomsState.data as room (room.chatId)}
					<button
						class={`grid w-full gap-2 px-4 py-4 text-left transition-colors hover:bg-muted/40 ${
							selectedRoomId === room.chatId ? 'bg-primary/5' : ''
						}`}
						onclick={() => onSelectRoom(room.chatId)}
					>
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<div class="truncate text-sm font-semibold">{room.title || room.chatId}</div>
								<div class="truncate text-[11px] text-muted-foreground">{room.chatId}</div>
							</div>
							{#if room.readProgress}
								<StatusRing
									value={room.readProgress.readSeatCount}
									total={Math.max(room.readProgress.totalSeatCount, 1)}
									label={`${room.readProgress.readSeatCount}/${room.readProgress.totalSeatCount} seats read`}
									class="text-primary"
								/>
							{/if}
						</div>
						<div class="truncate text-[11px] text-muted-foreground">
							{room.participants.length} participants · updated {formatTimestamp(room.updatedAt)}
						</div>
					</button>
				{/each}
			{/if}
		</ScrollView>
	</PanelShell>

	<PanelShell>
		{#snippet header()}
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="min-w-0">
					<h2 class="text-base font-semibold">{selectedRoom?.title ?? 'Room transcript'}</h2>
					<p class="text-sm text-muted-foreground">
						{selectedRoom?.chatId ?? 'Select a room to inspect the shared room transcript.'}
					</p>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" disabled={!selectedRoom} onclick={() => openManageDialog('overview')}>
						Manage room
					</Button>
				</div>
			</div>
			{#if selectedRoom}
				<div class="grid gap-2 md:grid-cols-[14rem_14rem]">
					<label class="grid gap-1 text-xs font-medium text-muted-foreground">
						<span>View as</span>
						<NativeSelect.Root
							aria-label="View as"
							wrapperClass="w-full"
							value={selectedViewerActorId ?? ''}
							onchange={(event) => {
								onChangeViewerActorId((event.currentTarget as HTMLSelectElement).value);
							}}
						>
							{#each roomSeatStates as state (state.actorId)}
								<option value={state.actorId}>{describeSeatOption(state)}</option>
							{/each}
						</NativeSelect.Root>
					</label>
					<label class="grid gap-1 text-xs font-medium text-muted-foreground">
						<span>Send as</span>
						<NativeSelect.Root
							aria-label="Send as"
							wrapperClass="w-full"
							value={selectedCallerToken ?? ''}
							onchange={(event) => {
								onChangeCallerToken((event.currentTarget as HTMLSelectElement).value);
							}}
						>
							{#each sendAsOptions as option (option.accessToken)}
								<option value={option.accessToken}>{describeSendAsOption(option)}</option>
							{/each}
						</NativeSelect.Root>
					</label>
				</div>
			{/if}
		{/snippet}

		<div class="h-full">
			<WebChatViewHost
				channel={selectedRoom}
				viewerActorId={selectedViewerActorId}
				{initialMessages}
				{initialSnapshotResolved}
				class="h-full"
				showHeader={false}
				emptyTitle="No room selected"
				emptyMessage="Choose one room from the left rail or create a new room to begin."
				emptyTranscriptTitle="No room facts yet"
				emptyTranscriptMessage="Send the first message to begin this room."
				{routeNotice}
				onSendMessage={onSendMessage}
				onLatestVisibleMessageIdChange={onLatestVisibleMessageIdChange}
			/>
		</div>
	</PanelShell>
</div>

<MessageRoomManageDialog
	bind:open={manageDialogOpen}
	bind:section={manageSection}
	{selectedRoom}
	{disableManageDialogPortal}
	{editableTitle}
	{titleBusy}
	{archiveBusy}
	{deleteBusy}
	{readSeatCount}
	{readSeatTotal}
	{roomSeatStates}
	{selectedViewerLabel}
	{selectableActors}
	{grantParticipantId}
	{grantRole}
	{grantBusy}
	{grantError}
	{formatTimestamp}
	onEditableTitleChange={setEditableTitle}
	onSaveTitle={() => void handleSaveTitle()}
	onArchive={() => void handleArchive()}
	onDelete={() => void handleDelete()}
	onSeatFocusClick={handleSeatFocusClick}
	onSeatRevokeClick={handleSeatRevokeClick}
	onGrantParticipantIdChange={setGrantParticipantId}
	onGrantRoleChange={(value) => {
		grantRole = value;
	}}
	onGrantSeat={() => void handleGrantSeat()}
/>

<Dialog.Root bind:open={createDialogOpen}>
	<Dialog.Content class="sm:max-w-xl">
		<form class="grid gap-4" onsubmit={handleCreateRoomSubmit}>
			<Dialog.Header>
				<Dialog.Title>Create room</Dialog.Title>
				<Dialog.Description>
					room is the chat channel inside message-system. Participants here only declare seat candidates.
				</Dialog.Description>
			</Dialog.Header>

			<label class="grid gap-2 text-sm font-medium">
				<span>Room title</span>
				<Input bind:value={createTitle} name="roomTitle" placeholder="Ops room" />
			</label>

			<div class="grid gap-2">
				<div class="text-sm font-medium">Participants</div>
				<div class="grid h-80 gap-2 rounded-2xl border p-3">
					<ScrollView class="h-full" contentClass="grid gap-2">
						{#each selectableActors as actor (actor.actorId)}
							<label class="flex items-center gap-3 rounded-xl border p-3">
								<Checkbox
									checked={Boolean(createSelection[actor.actorId])}
									onCheckedChange={(checked) => {
										createSelection = {
											...createSelection,
											[actor.actorId]: Boolean(checked),
										};
									}}
								/>
								<ProfileAvatar label={actor.label} src={actor.iconUrl} class="size-8" />
								<div class="min-w-0">
									<div class="truncate text-sm font-medium">{actor.label}</div>
									<div class="truncate text-xs text-muted-foreground">
										{actor.subtitle ?? actor.actorId}
									</div>
								</div>
							</label>
						{/each}
					</ScrollView>
				</div>
			</div>

			{#if createError}
				<div class="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
					{createError}
				</div>
			{/if}

			<Dialog.Footer>
				<Button
					type="button"
					variant="ghost"
					onclick={() => {
						createDialogOpen = false;
						resetCreateDialog();
					}}
					disabled={createBusy}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={createBusy} aria-label="Submit create room">
					{createBusy ? 'Creating…' : 'Create room'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
