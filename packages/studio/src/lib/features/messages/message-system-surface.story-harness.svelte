<script lang="ts">
	import type { CachedResourceState, GlobalRoomEntry } from '@agenter/client-sdk';
	import type { WebChatNotice } from '@agenter/web-chat-view';
	import { untrack } from 'svelte';

	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import MessageSystemSurface from './message-system-surface.svelte';

	import type {
		MessageSystemManageSection,
		MessageSystemRoomAssetItem,
		MessageSystemRoomSeatState,
		MessageSystemSendAsOption,
	} from './message-system-surface.types';

	let {
		disableManageDialogPortal = false,
		initialManageDialogSection = null,
		surfaceClass = 'h-[52rem] w-full min-w-0 bg-background',
		fixture = 'default',
	}: {
		disableManageDialogPortal?: boolean;
		initialManageDialogSection?: MessageSystemManageSection | null;
		surfaceClass?: string;
		fixture?: HarnessFixture;
	} = $props();

	type HarnessFixture = 'default' | 'control-only' | 'readonly-viewer';

		const storySourceSystemId = '0x0000000000000000000000000000000000000001' as const;

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
			superKey: storySourceSystemId,
			createdBySystemId: storySourceSystemId,
			participants: input.participants,
			createdAt: input.updatedAt - 1_000,
			updatedAt: input.updatedAt,
			focused: true,
			roomRevision: '0',
			transcriptRevision: '0',
			accessRole: 'admin',
		accessToken: `token:${input.chatId}:admin`,
		participantId: 'system:trusted-bootstrap',
		currentAdmin: true,
		transportUrl: `ws://127.0.0.1:4581/room/${input.chatId}?token=token:${input.chatId}:admin`,
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

	const defaultInitialSeats = [
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
	] satisfies MessageSystemRoomSeatState[];
	const readonlyViewerSeats = [
		...defaultInitialSeats,
		{
			actorId: 'auth:wallet_evm',
			actorKind: 'auth',
			label: 'Wallet Operator',
			subtitle: 'auth:wallet_evm',
			iconUrl: null,
			role: 'readonly',
			currentAdmin: false,
			online: false,
			focused: false,
			invalidCredential: false,
			accessToken: `token:${initialRoomId}:wallet-readonly`,
			grantId: `${initialRoomId}:grant:wallet-readonly`,
		},
	] satisfies MessageSystemRoomSeatState[];
	const initialFixture = untrack(() => fixture);
	const createInitialViewerSelection = (currentFixture: HarnessFixture): Record<string, string> =>
		currentFixture === 'control-only'
			? {}
			: {
					[initialRoomId]: currentFixture === 'readonly-viewer' ? 'auth:wallet_evm' : 'auth:analyst',
				};
	const createInitialSeatState = (
		currentFixture: HarnessFixture,
	): Record<string, MessageSystemRoomSeatState[]> => ({
		[initialRoomId]:
			currentFixture === 'control-only'
				? []
				: currentFixture === 'readonly-viewer'
					? [...readonlyViewerSeats]
					: [...defaultInitialSeats],
	});

	let selectedRoomId = $state(initialRoomId);
	let routeNotice: WebChatNotice | null = $state(null);
	let selectedViewerActorIdByRoomId = $state<Record<string, string>>(createInitialViewerSelection(initialFixture));
	let roomAssetsById: Record<string, MessageSystemRoomAssetItem[]> = $state(initialRoomAssets);
	let roomSeatsById = $state<Record<string, MessageSystemRoomSeatState[]>>(createInitialSeatState(initialFixture));
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
			if (!seat.accessToken || seat.role === 'readonly' || seat.actorId === room.participantId) {
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
	const selectedViewerAccessToken = $derived.by(() => {
		const room = selectedRoom;
		const viewerActorId = selectedViewerActorId;
		if (!room || !viewerActorId) {
			return null;
		}
		const viewerSeat = roomSeatStates.find((seat) => seat.actorId === viewerActorId) ?? null;
		return viewerSeat?.accessToken ?? (room.participantId === viewerActorId ? room.accessToken ?? null : null);
	});

	const updateRoomEntry = (chatId: string, updater: (room: GlobalRoomEntry) => GlobalRoomEntry): void => {
		roomsState = {
			...roomsState,
			data: roomsState.data.map((room) => (room.chatId === chatId ? updater(room) : room)),
			refreshedAt: Date.now(),
		};
	};

	const bumpRoomUpdatedAt = (chatId: string): void => {
		updateRoomEntry(chatId, (room) => ({
			...room,
			updatedAt: Date.now(),
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
		const nextRooms = roomsState.data.map((entry) =>
			entry.chatId === room.chatId
				? {
						...entry,
						archivedAt: Date.now(),
					}
				: entry,
		);
		roomsState = {
			...roomsState,
			data: nextRooms,
			refreshedAt: Date.now(),
		};
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
		bumpRoomUpdatedAt(room.chatId);
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
		bumpRoomUpdatedAt(room.chatId);
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
				archivedRoomCount={roomsState.data.filter((room) => Boolean(room.archivedAt)).length}
				roomSeatTruthLoaded={true}
				{disableManageDialogPortal}
				{initialManageDialogSection}
					{roomAssetsState}
				{routeNotice}
				{selectedCallerToken}
				{selectedViewerAccessToken}
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
				/>
		</WorkbenchWindow>
	</div>
</Tooltip.Provider>
