<script lang="ts">
	import type { CachedResourceState, GlobalRoomEntry, GlobalRoomSnapshotOutput } from '@agenter/client-sdk';
	import type { WebChatNotice } from '@agenter/web-chat-view';

	import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';
	import MessageSystemSurface from './message-system-surface.svelte';

	import type { MessageSystemRoomSeatState, MessageSystemSendAsOption } from './message-system-surface.types';

	let {
		disableManageDialogPortal = false,
		initialManageDialogSection = null,
	}: {
		disableManageDialogPortal?: boolean;
		initialManageDialogSection?: 'overview' | 'users' | 'access' | null;
	} = $props();

	const createRoomEntry = (input: {
		chatId: string;
		title: string;
		participants: GlobalRoomEntry['participants'];
		updatedAt: number;
		readSeatCount: number;
		totalSeatCount: number;
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
		readProgress: {
			latestVisibleMessageId: undefined,
			latestVisibleMessageRowId: undefined,
			latestVisibleAt: undefined,
			totalSeatCount: input.totalSeatCount,
			readSeatCount: input.readSeatCount,
			unreadSeatCount: Math.max(input.totalSeatCount - input.readSeatCount, 0),
			invalidCredentialSeatCount: 0,
		},
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
				messageId: 'msg-1',
				chatId: initialRoomId,
				senderActorId: 'system:trusted-bootstrap',
				from: 'Bootstrap admin',
				kind: 'text',
				content: 'Current operator room is live.',
				createdAt: 1_710_000_000_000,
				updatedAt: 1_710_000_000_000,
				visibleAt: 1_710_000_000_000,
				attentionState: 'loaded',
				editable: false,
				metadata: {},
				attachments: [],
			},
		],
	} satisfies Record<string, GlobalRoomSnapshotOutput['items']>;

	const initialSeats = {
		[initialRoomId]: [
			{
				actorId: 'system:trusted-bootstrap',
				actorKind: 'system',
				label: 'Bootstrap admin',
				subtitle: 'System seat',
				iconUrl: null,
				role: 'admin',
				currentAdmin: true,
				online: true,
				focused: true,
				invalidCredential: false,
				readAt: 1_710_000_000_500,
				hasReadLatestVisible: true,
				accessToken: `token:${initialRoomId}:admin`,
			},
			{
				actorId: 'auth:analyst',
				actorKind: 'auth',
				label: 'Analyst',
				subtitle: 'auth:analyst',
				iconUrl: null,
				role: 'member',
				currentAdmin: false,
				online: true,
				focused: false,
				invalidCredential: false,
				hasReadLatestVisible: false,
				accessToken: `token:${initialRoomId}:analyst`,
				grantId: `${initialRoomId}:grant:analyst`,
			},
		],
	} satisfies Record<string, MessageSystemRoomSeatState[]>;

	let roomCounter = $state(1);
	let messageCounter = $state(2);
	let selectedRoomId = $state(initialRoomId);
	let routeNotice: WebChatNotice | null = $state(null);
	let selectedCallerTokenByRoomId: Record<string, string> = $state({
		[initialRoomId]: `token:${initialRoomId}:admin`,
	});
	let selectedViewerActorIdByRoomId: Record<string, string> = $state({
		[initialRoomId]: 'system:trusted-bootstrap',
	});
	let roomMessagesById: Record<string, GlobalRoomSnapshotOutput['items']> = $state(initialMessages);
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
				readSeatCount: 1,
				totalSeatCount: 2,
			}),
		],
		loaded: true,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: 1_710_000_000_000,
	});

	const selectedRoom = $derived(roomsState.data.find((room) => room.chatId === selectedRoomId) ?? null);
	const selectedMessages = $derived(roomMessagesById[selectedRoomId] ?? []);
	const roomSeatStates = $derived(roomSeatsById[selectedRoomId] ?? []);
	const readSeatCount = $derived(roomSeatStates.filter((seat) => seat.hasReadLatestVisible).length);
	const readSeatTotal = $derived(Math.max(roomSeatStates.length, 1));
	const sendAsOptions = $derived.by(() => {
		const room = selectedRoom;
		if (!room) {
			return [] as MessageSystemSendAsOption[];
		}
		const options: MessageSystemSendAsOption[] = [
			{
				accessToken: room.accessToken,
				participantId: room.participantId,
				role: room.accessRole,
				label: 'Bootstrap admin',
			},
		];
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
	const selectedCallerToken = $derived(
		selectedCallerTokenByRoomId[selectedRoomId] ?? sendAsOptions[0]?.accessToken ?? null,
	);
	const selectedViewerActorId = $derived(
		selectedViewerActorIdByRoomId[selectedRoomId] ?? roomSeatStates[0]?.actorId ?? null,
	);

	const updateRoomEntry = (chatId: string, updater: (room: GlobalRoomEntry) => GlobalRoomEntry): void => {
		roomsState = {
			...roomsState,
			data: roomsState.data.map((room) => (room.chatId === chatId ? updater(room) : room)),
			refreshedAt: Date.now(),
		};
	};

	const syncRoomProgress = (chatId: string): void => {
		const seats = roomSeatsById[chatId] ?? [];
		const messages = roomMessagesById[chatId] ?? [];
		const latestMessage = messages.at(-1);
		updateRoomEntry(chatId, (room) => ({
			...room,
			updatedAt: latestMessage?.updatedAt ?? room.updatedAt,
			readProgress: {
				latestVisibleMessageId: latestMessage?.messageId,
				latestVisibleMessageRowId: latestMessage?.rowId,
				latestVisibleAt: latestMessage?.visibleAt,
				totalSeatCount: Math.max(seats.length, 1),
				readSeatCount: seats.filter((seat) => seat.hasReadLatestVisible).length,
				unreadSeatCount: seats.filter((seat) => !seat.hasReadLatestVisible).length,
				invalidCredentialSeatCount: seats.filter((seat) => seat.invalidCredential).length,
			},
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

	const setSelectedRoom = (chatId: string): void => {
		selectedRoomId = chatId;
		routeNotice = null;
	};

	const handleCreateRoom = async (input: { title?: string; participantIds: string[] }): Promise<void> => {
		roomCounter += 1;
		const chatId = `room-story-${roomCounter}`;
		const createdAt = 1_710_000_000_000 + roomCounter * 10_000;
		const participants = [
			{ id: 'system:trusted-bootstrap', label: 'Bootstrap admin' },
			...input.participantIds.map((participantId) => ({
				id: participantId,
				label: findActor(participantId).label,
			})),
		];
		roomMessagesById = {
			...roomMessagesById,
			[chatId]: [],
		};
		roomSeatsById = {
			...roomSeatsById,
			[chatId]: [
				{
					actorId: 'system:trusted-bootstrap',
					actorKind: 'system',
					label: 'Bootstrap admin',
					subtitle: 'System seat',
					iconUrl: null,
					role: 'admin',
					currentAdmin: true,
					online: true,
					focused: true,
					invalidCredential: false,
					hasReadLatestVisible: false,
					accessToken: `token:${chatId}:admin`,
				},
			],
		};
		roomsState = {
			...roomsState,
			data: [
				createRoomEntry({
					chatId,
					title: input.title ?? `Story room ${roomCounter}`,
					participants,
					updatedAt: createdAt,
					readSeatCount: 0,
					totalSeatCount: 1,
				}),
				...roomsState.data,
			],
			refreshedAt: createdAt,
		};
		selectedCallerTokenByRoomId = {
			...selectedCallerTokenByRoomId,
			[chatId]: `token:${chatId}:admin`,
		};
		selectedViewerActorIdByRoomId = {
			...selectedViewerActorIdByRoomId,
			[chatId]: 'system:trusted-bootstrap',
		};
		setSelectedRoom(chatId);
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
					hasReadLatestVisible: false,
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
		syncRoomProgress(room.chatId);
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
		syncRoomProgress(room.chatId);
	};

	const handleSendMessage = async (input: { text: string; assets: File[] }): Promise<void> => {
		const room = selectedRoom;
		if (!room) {
			return;
		}
		messageCounter += 1;
		const messageId = `msg-${messageCounter}`;
		const selectedToken = selectedCallerToken;
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
					messageId,
					chatId: room.chatId,
					senderActorId,
					from: sender,
					kind: 'text',
					content: input.text,
					createdAt: 1_710_000_000_000 + messageCounter * 1_000,
					updatedAt: 1_710_000_000_000 + messageCounter * 1_000,
					visibleAt: 1_710_000_000_000 + messageCounter * 1_000,
					attentionState: 'loaded',
					editable: false,
					metadata: {},
					attachments: [],
				},
			],
		};
		roomSeatsById = {
			...roomSeatsById,
			[room.chatId]: (roomSeatsById[room.chatId] ?? []).map((seat) => ({
				...seat,
				hasReadLatestVisible: seat.actorId === senderActorId,
				readAt: seat.actorId === senderActorId ? Date.now() : undefined,
			})),
		};
		syncRoomProgress(room.chatId);
	};

	const handleLatestVisibleMessageIdChange = async (messageId: string | null): Promise<void> => {
		const room = selectedRoom;
		if (!room || !messageId) {
			return;
		}
		const actorId = selectedViewerActorId ?? 'system:trusted-bootstrap';
		roomSeatsById = {
			...roomSeatsById,
			[room.chatId]: (roomSeatsById[room.chatId] ?? []).map((seat) =>
				seat.actorId === actorId
					? {
							...seat,
							hasReadLatestVisible: true,
							readAt: Date.now(),
						}
					: seat,
			),
		};
		syncRoomProgress(room.chatId);
	};

	const handleCallerTokenChange = (accessToken: string): void => {
		selectedCallerTokenByRoomId = {
			...selectedCallerTokenByRoomId,
			[selectedRoomId]: accessToken,
		};
	};

	const handleViewerActorIdChange = (actorId: string): void => {
		selectedViewerActorIdByRoomId = {
			...selectedViewerActorIdByRoomId,
			[selectedRoomId]: actorId,
		};
	};
</script>

<div class="h-[52rem] w-full min-w-[72rem] bg-background">
	<MessageSystemSurface
		{roomsState}
		{selectedRoomId}
		{selectedRoom}
		{disableManageDialogPortal}
		{initialManageDialogSection}
		initialMessages={selectedMessages}
		initialSnapshotResolved={true}
		{routeNotice}
		{readSeatCount}
		{readSeatTotal}
		{sendAsOptions}
		{selectedCallerToken}
		{selectedViewerActorId}
		selectableActors={actorCatalog}
		{roomSeatStates}
		onSelectRoom={setSelectedRoom}
		onChangeCallerToken={handleCallerTokenChange}
		onChangeViewerActorId={handleViewerActorIdChange}
		onSaveRoomTitle={handleSaveRoomTitle}
		onArchiveRoom={handleArchiveRoom}
		onDeleteRoom={handleDeleteRoom}
		onCreateRoom={handleCreateRoom}
		onGrantSeat={handleGrantSeat}
		onToggleSeatFocus={handleToggleSeatFocus}
		onRevokeSeat={handleRevokeSeat}
		onSendMessage={handleSendMessage}
		onLatestVisibleMessageIdChange={handleLatestVisibleMessageIdChange}
	/>
</div>
