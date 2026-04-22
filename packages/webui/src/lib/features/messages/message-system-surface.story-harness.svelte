<script lang="ts">
	import type { CachedResourceState, GlobalRoomEntry, GlobalRoomSnapshotOutput } from '@agenter/client-sdk';
	import type { WebChatNotice, WebChatVisibleMessageFact } from '@agenter/web-chat-view';

	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import MessageSystemSurface from './message-system-surface.svelte';

	import type {
		MessageSystemRoomAssetItem,
		MessageSystemRoomSeatState,
		MessageSystemSendAsOption,
	} from './message-system-surface.types';

	let {
		disableManageDialogPortal = false,
		initialManageDialogSection = null,
		surfaceClass = 'h-[52rem] w-full min-w-0 bg-background',
	}: {
		disableManageDialogPortal?: boolean;
		initialManageDialogSection?: 'overview' | 'users' | 'permissions' | null;
		surfaceClass?: string;
	} = $props();

	type RoomMessage = GlobalRoomSnapshotOutput['items'][number];
	type RoomActorId = RoomMessage['readActorIds'][number];

	const isRoomActorId = (actorId: string): actorId is RoomActorId =>
		actorId.startsWith('auth:') || actorId.startsWith('session:') || actorId.startsWith('system:');
	const normalizeRoomActorIds = (actorIds: readonly string[]): RoomActorId[] =>
		[...new Set(actorIds.filter(isRoomActorId))].sort();

	const createRoomEntry = (input: {
		chatId: string;
		title: string;
		participants: GlobalRoomEntry['participants'];
		updatedAt: number;
	}): GlobalRoomEntry => ({
		chatId: input.chatId,
		kind: 'room',
		title: input.title,
		owner: 'root',
		participants: input.participants,
		createdAt: input.updatedAt - 1_000,
		updatedAt: input.updatedAt,
		focused: true,
		accessRole: 'admin',
		accessToken: `token:${input.chatId}:admin`,
		participantId: 'system:trusted-bootstrap',
		currentAdmin: true,
		transportUrl: undefined,
	});

	const actorCatalog: ActorDirectoryEntry[] = [
		{
			actorId: 'auth:analyst',
			actorKind: 'auth',
			label: 'Analyst',
			subtitle: 'auth:analyst',
			iconUrl: null,
		},
		{
			actorId: 'auth:wallet_evm',
			actorKind: 'auth',
			label: 'Wallet Operator',
			subtitle: 'auth:wallet_evm',
			iconUrl: null,
		},
		{
			actorId: 'session:reviewer',
			actorKind: 'session',
			label: 'Analyst',
			subtitle: '/repo/reviewer',
			iconUrl: null,
		},
	];

	const initialRoomId = 'room-ops';
	const initialMessages = {
		[initialRoomId]: [
			{
				rowId: 1,
				messageId: 1,
				chatId: initialRoomId,
				senderActorId: 'system:trusted-bootstrap',
				from: 'Bootstrap admin',
				kind: 'text',
				content: 'Current operator room is live.',
				createdAt: 1_710_000_000_000,
				updatedAt: 1_710_000_000_000,
				visibleAt: 1_710_000_000_000,
				readActorIds: normalizeRoomActorIds(['auth:analyst']),
				unreadActorIds: normalizeRoomActorIds([]),
				metadata: {},
				attachments: [],
			},
		],
	} satisfies Record<string, GlobalRoomSnapshotOutput['items']>;
	const initialRoomAssets: Record<string, MessageSystemRoomAssetItem[]> = {
		[initialRoomId]: [
			{
				assetId: 'asset-room-brief',
				kind: 'file',
				name: 'ops-brief.txt',
				mimeType: 'text/plain',
				sizeBytes: 128,
				url: '/media/rooms/room-ops/assets/asset-room-brief',
				createdAt: 1_710_000_000_000,
				updatedAt: 1_710_000_000_000,
				uploaderLabel: 'Analyst',
				uploaderSubtitle: 'auth:analyst',
				uploaderIconUrl: null,
			},
		],
	};

	const initialSeats = {
		[initialRoomId]: [
			{
				actorId: 'auth:analyst',
				actorKind: 'auth',
				label: 'Analyst',
				subtitle: 'auth:analyst',
				iconUrl: null,
				role: 'admin',
				currentAdmin: true,
				online: true,
				focused: true,
				invalidCredential: false,
				accessToken: `token:${initialRoomId}:analyst`,
				grantId: `${initialRoomId}:grant:analyst`,
			},
		],
	} satisfies Record<string, MessageSystemRoomSeatState[]>;

	let messageCounter = $state(2);
	let selectedRoomId = $state(initialRoomId);
	let routeNotice: WebChatNotice | null = $state(null);
	let selectedViewerActorIdByRoomId: Record<string, string> = $state({
		[initialRoomId]: 'auth:analyst',
	});
	let roomMessagesById: Record<string, GlobalRoomSnapshotOutput['items']> = $state(initialMessages);
	let roomAssetsById: Record<string, MessageSystemRoomAssetItem[]> = $state(initialRoomAssets);
	let roomSeatsById: Record<string, MessageSystemRoomSeatState[]> = $state(initialSeats);
	let roomsState: CachedResourceState<GlobalRoomEntry[]> = $state({
		data: [
			createRoomEntry({
				chatId: initialRoomId,
				title: 'Ops bridge',
				participants: [
					{ id: 'system:trusted-bootstrap', label: 'Bootstrap admin' },
					{ id: 'auth:analyst', label: 'Analyst' },
				],
				updatedAt: 1_710_000_000_000,
			}),
		],
		loaded: true,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: 1_710_000_000_000,
	});

	const selectedRoom = $derived(roomsState.data.find((room) => room.chatId === selectedRoomId) ?? null);
	const workbenchTabs = $derived.by(
		() =>
			roomsState.data.map(
				(room): WorkbenchTabItem => ({
					id: room.chatId,
					label: room.title || room.chatId,
					title: room.title || room.chatId,
					description: room.chatId,
					avatarLabel: room.title || room.chatId,
					avatarUrl: null,
				}),
			),
	);
	const selectedMessages = $derived(roomMessagesById[selectedRoomId] ?? []);
	const roomSeatStates = $derived(roomSeatsById[selectedRoomId] ?? []);
	const roomAssetsState = $derived(
		({
			data: roomAssetsById[selectedRoomId] ?? [],
			loaded: true,
			loading: false,
			refreshing: false,
			error: null,
			refreshedAt: Date.now(),
		}) satisfies CachedResourceState<(typeof initialRoomAssets)[typeof initialRoomId]>,
	);
	const sendAsOptions = $derived.by(() => {
		const room = selectedRoom;
		if (!room) {
			return [] as MessageSystemSendAsOption[];
		}
		const options: MessageSystemSendAsOption[] = [];
		for (const seat of roomSeatStates) {
			if (!seat.accessToken || seat.actorId === room.participantId) {
				continue;
			}
			options.push({
				accessToken: seat.accessToken,
				participantId: seat.actorId,
				role: seat.role,
				label: seat.label,
			});
		}
		return options;
	});
	const selectedViewerActorId = $derived.by(() => {
		const selected = selectedViewerActorIdByRoomId[selectedRoomId];
		if (selected && roomSeatStates.some((seat) => seat.actorId === selected)) {
			return selected;
		}
		return roomSeatStates[0]?.actorId ?? null;
	});
	const selectedCallerToken = $derived.by(() => {
		const room = selectedRoom;
		const viewerActorId = selectedViewerActorId;
		if (!room || !viewerActorId) {
			return null;
		}
		if (room.participantId === viewerActorId) {
			return room.accessToken ?? null;
		}
		return sendAsOptions.find((option) => option.participantId === viewerActorId)?.accessToken ?? null;
	});

	const updateRoomEntry = (chatId: string, updater: (room: GlobalRoomEntry) => GlobalRoomEntry): void => {
		roomsState = {
			...roomsState,
			data: roomsState.data.map((room) => (room.chatId === chatId ? updater(room) : room)),
			refreshedAt: Date.now(),
		};
	};

	const syncRoomMetadata = (chatId: string): void => {
		const messages = roomMessagesById[chatId] ?? [];
		const latestMessage = messages.at(-1);
		updateRoomEntry(chatId, (room) => ({
			...room,
			updatedAt: latestMessage?.updatedAt ?? room.updatedAt,
		}));
	};

	const findActor = (actorId: string): ActorDirectoryEntry => {
		return (
			actorCatalog.find((actor) => actor.actorId === actorId) ?? {
				actorId,
				actorKind: actorId.startsWith('session:') ? 'session' : 'auth',
				label: actorId.split(':').at(-1) ?? actorId,
				subtitle: actorId,
				iconUrl: null,
			}
		);
	};

	const handleSaveRoomTitle = async (title: string): Promise<void> => {
		const room = selectedRoom;
		if (!room) {
			return;
		}
		updateRoomEntry(room.chatId, (entry) => ({
			...entry,
			title,
		}));
	};

	const handleArchiveRoom = async (): Promise<void> => {
		const room = selectedRoom;
		if (!room) {
			return;
		}
		const nextRooms = roomsState.data.filter((entry) => entry.chatId !== room.chatId);
		roomsState = {
			...roomsState,
			data: nextRooms,
			refreshedAt: Date.now(),
		};
		selectedRoomId = nextRooms[0]?.chatId ?? '';
	};

	const handleDeleteRoom = handleArchiveRoom;

	const handleGrantSeat = async (input: { participantId: string; role: 'admin' | 'member' | 'readonly' }) => {
		const room = selectedRoom;
		if (!room) {
			return;
		}
		const actor = findActor(input.participantId);
		const grantId = `${room.chatId}:grant:${input.participantId}`;
		roomSeatsById = {
			...roomSeatsById,
			[room.chatId]: [
				...(roomSeatsById[room.chatId] ?? []).filter((seat) => seat.actorId !== input.participantId),
				{
					...actor,
					role: input.role,
					currentAdmin: false,
					online: false,
					focused: false,
					invalidCredential: false,
					accessToken: `token:${room.chatId}:${input.participantId}`,
					grantId,
				},
			],
		};
		updateRoomEntry(room.chatId, (entry) => ({
			...entry,
			participants: entry.participants.some((participant) => participant.id === input.participantId)
				? entry.participants
				: [...entry.participants, { id: input.participantId, label: actor.label }],
		}));
		syncRoomMetadata(room.chatId);
	};

	const handleToggleSeatFocus = async (input: {
		actorId: string;
		accessToken: string;
		focused: boolean;
	}): Promise<void> => {
		const room = selectedRoom;
		if (!room) {
			return;
		}
		roomSeatsById = {
			...roomSeatsById,
			[room.chatId]: (roomSeatsById[room.chatId] ?? []).map((seat) =>
				seat.actorId === input.actorId
					? {
							...seat,
							focused: !input.focused,
						}
					: seat,
			),
		};
	};

	const handleRevokeSeat = async (input: { actorId: string; grantId: string }): Promise<void> => {
		const room = selectedRoom;
		if (!room) {
			return;
		}
		roomSeatsById = {
			...roomSeatsById,
			[room.chatId]: (roomSeatsById[room.chatId] ?? []).filter((seat) => seat.grantId !== input.grantId),
		};
		syncRoomMetadata(room.chatId);
	};

	const handleSendMessage = async (input: { text: string; assets: File[] }): Promise<void> => {
		const room = selectedRoom;
		const selectedToken = selectedCallerToken;
		if (!room || !selectedToken) {
			return;
		}
		messageCounter += 1;
		const senderOption = sendAsOptions.find((option) => option.accessToken === selectedToken);
		const sender = senderOption?.label ?? 'Bootstrap admin';
		const senderActorId = (senderOption?.participantId ??
			'system:trusted-bootstrap') as GlobalRoomSnapshotOutput['items'][number]['senderActorId'];
		roomMessagesById = {
			...roomMessagesById,
			[room.chatId]: [
				...(roomMessagesById[room.chatId] ?? []).map((message) => ({
					...message,
				})),
				{
					rowId: messageCounter,
					messageId: messageCounter,
					chatId: room.chatId,
					senderActorId,
					from: sender,
					kind: 'text',
					content: input.text,
					createdAt: 1_710_000_000_000 + messageCounter * 1_000,
					updatedAt: 1_710_000_000_000 + messageCounter * 1_000,
					visibleAt: 1_710_000_000_000 + messageCounter * 1_000,
					readActorIds:
						senderActorId === 'system:trusted-bootstrap'
							? normalizeRoomActorIds([])
							: normalizeRoomActorIds(
									(roomSeatsById[room.chatId] ?? [])
									.filter((seat) => seat.actorId === senderActorId)
									.map((seat) => seat.actorId),
								),
					unreadActorIds: normalizeRoomActorIds(
						(roomSeatsById[room.chatId] ?? [])
							.map((seat) => seat.actorId)
							.filter((actorId) => actorId !== senderActorId),
					),
					metadata: {},
					attachments: [],
				},
			],
		};
		syncRoomMetadata(room.chatId);
	};

	const handleLatestVisibleMessageIdChange = async (
		visibleMessage: WebChatVisibleMessageFact | null,
	): Promise<void> => {
		const room = selectedRoom;
		if (!room || !visibleMessage || !visibleMessage.messageId) {
			return;
		}
		const actorId = selectedViewerActorId;
		if (!actorId) {
			return;
		}
		if (visibleMessage.rowId <= 0) {
			return;
		}
		const targetRowId = visibleMessage.rowId;
		roomMessagesById = {
			...roomMessagesById,
			[room.chatId]: (roomMessagesById[room.chatId] ?? []).map((message) =>
				message.rowId > targetRowId
					? message
					: {
							...message,
							readActorIds: normalizeRoomActorIds([...(message.readActorIds ?? []), actorId]),
							unreadActorIds: normalizeRoomActorIds(
								(message.unreadActorIds ?? []).filter((candidateActorId) => candidateActorId !== actorId),
							),
						},
			),
		};
		syncRoomProgress(room.chatId);
	};

	const handleViewerActorIdChange = (actorId: string): void => {
		selectedViewerActorIdByRoomId = {
			...selectedViewerActorIdByRoomId,
			[selectedRoomId]: actorId,
		};
	};
</script>

<Tooltip.Provider delayDuration={0}>
	<div class={surfaceClass}>
		<WorkbenchWindow
			ariaLabel="Message room story window"
			value={selectedRoomId}
			tabs={workbenchTabs}
			bodyClass="h-full"
			class="h-full"
			onValueChange={(nextRoomId) => {
				selectedRoomId = nextRoomId;
			}}
		>
			<MessageSystemSurface
				{selectedRoom}
				authenticated={true}
				{disableManageDialogPortal}
				{initialManageDialogSection}
				initialMessages={selectedMessages}
				initialSnapshotResolved={true}
				{roomAssetsState}
				{routeNotice}
				{selectedCallerToken}
				{selectedViewerActorId}
				selectableActors={actorCatalog}
				{roomSeatStates}
				onChangeViewerActorId={handleViewerActorIdChange}
				onSaveRoomTitle={handleSaveRoomTitle}
				onArchiveRoom={handleArchiveRoom}
				onDeleteRoom={handleDeleteRoom}
				onGrantSeat={handleGrantSeat}
				onToggleSeatFocus={handleToggleSeatFocus}
				onRevokeSeat={handleRevokeSeat}
				onSendMessage={handleSendMessage}
				onLatestVisibleMessageIdChange={handleLatestVisibleMessageIdChange}
			/>
		</WorkbenchWindow>
	</div>
</Tooltip.Provider>
