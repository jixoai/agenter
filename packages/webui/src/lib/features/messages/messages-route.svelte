<script lang="ts">
	import type {
		CachedResourceState,
		GlobalRoomEntry,
		GlobalRoomGrantEntry,
		GlobalRoomSnapshotOutput,
	} from '@agenter/client-sdk';
	import type { WebChatNotice } from '@agenter/web-chat-view';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import {
		buildActorDirectory,
		buildActorDirectoryMap,
		fallbackActorLabel,
		type ActorDirectoryEntry,
	} from '$lib/features/collaboration/actor-directory';

	import MessageSystemSurface from './message-system-surface.svelte';
	import type {
		MessageSystemGrantRole,
		MessageSystemRoomSeatState,
		MessageSystemSendAsOption,
	} from './message-system-surface.types';

	const controller = getAppControllerContext();

	const emptyRoomCatalogState: CachedResourceState<GlobalRoomEntry[]> = {
		data: [],
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};
	const emptyRoomSnapshotState: CachedResourceState<GlobalRoomSnapshotOutput | null> = {
		data: null,
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};
	const emptyRoomGrantState: CachedResourceState<GlobalRoomGrantEntry[]> = {
		data: [],
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};

	type RoomSeatState = {
		actorId: string;
		role: MessageSystemGrantRole;
		label?: string;
		currentAdmin: boolean;
		online: boolean;
		focused: boolean;
		invalidCredential: boolean;
		readAt?: number;
		hasReadLatestVisible: boolean;
		accessToken?: string;
		grantId?: string;
	};

	let selectedRoomId = $state(page.url.searchParams.get('roomId') ?? '');
	let selectedCallerTokenByRoomId = $state<Record<string, string>>({});
	let latestMarkedReadBySeat = $state<Record<string, string | null>>({});
	let routeNotice = $state<WebChatNotice | null>(null);

	const actorDirectory = $derived(
		buildActorDirectory({
			sessions: controller.runtimeState.sessions,
			authActors: controller.authActors,
			profileIconUrl: (reference) => controller.runtimeStore.profileIconUrl(reference ?? ''),
			sessionIconUrl: (sessionId) => (sessionId ? controller.runtimeStore.sessionIconUrl(sessionId) : null),
		}),
	);
	const actorDirectoryMap = $derived(buildActorDirectoryMap(actorDirectory));
	const selectableActors = $derived(actorDirectory.filter((actor) => actor.actorKind !== 'system'));
	const roomsState = $derived(controller.runtimeState.globalRooms ?? emptyRoomCatalogState);
	const rooms = $derived(roomsState.data);
	const selectedRoom = $derived(rooms.find((room) => room.chatId === selectedRoomId) ?? null);
	const selectedRoomSnapshotState = $derived(
		selectedRoomId
			? (controller.runtimeState.globalRoomSnapshotsById[selectedRoomId] ?? emptyRoomSnapshotState)
			: emptyRoomSnapshotState,
	);
	const selectedRoomSnapshot = $derived(selectedRoomSnapshotState.data);
	const selectedRoomProjection = $derived(selectedRoomSnapshot?.channel ?? selectedRoom ?? null);
	const selectedRoomGrantsState = $derived(
		selectedRoomId
			? (controller.runtimeState.globalRoomGrantsById[selectedRoomId] ?? emptyRoomGrantState)
			: emptyRoomGrantState,
	);
	const roomGrants = $derived(selectedRoomGrantsState.data);

	const asRoomActorId = (value: string): `auth:${string}` | `session:${string}` | `system:${string}` | null => {
		return /^((auth|session|system):.+)$/u.test(value)
			? (value as `auth:${string}` | `session:${string}` | `system:${string}`)
			: null;
	};

	const describeActor = (actorId: string | undefined, fallback: string): ActorDirectoryEntry => {
		if (actorId && actorDirectoryMap.has(actorId)) {
			return actorDirectoryMap.get(actorId)!;
		}
		return {
			actorId: actorId ?? fallback,
			actorKind: actorId?.startsWith('session:')
				? 'session'
				: actorId?.startsWith('system:')
					? 'system'
					: 'auth',
			label: fallbackActorLabel(actorId ?? fallback),
			subtitle: actorId,
			iconUrl: null,
		};
	};

	const sendAsOptions = $derived.by(() => {
		const room = selectedRoomProjection;
		if (!room) {
			return [] as MessageSystemSendAsOption[];
		}

		const options = [
			{
				accessToken: room.accessToken,
				participantId: room.participantId,
				role: room.accessRole,
				label:
					(room.participantId
						? actorDirectoryMap.get(room.participantId)?.label ?? fallbackActorLabel(room.participantId)
						: undefined) ?? 'Admin seat',
			},
			...roomGrants
				.filter((grant) => Boolean(grant.accessToken))
				.map((grant) => ({
					accessToken: grant.accessToken ?? '',
					participantId: grant.participantId,
					role: grant.role,
					label:
						(grant.participantId ? actorDirectoryMap.get(grant.participantId)?.label : undefined) ??
						grant.label ??
						fallbackActorLabel(grant.participantId ?? grant.grantId),
				})),
		];
		return options.filter((option) => option.accessToken);
	});

	const selectedCallerToken = $derived.by(() => {
		const room = selectedRoomProjection;
		if (!room) {
			return null;
		}
		const selected = selectedCallerTokenByRoomId[room.chatId];
		if (selected && sendAsOptions.some((option) => option.accessToken === selected)) {
			return selected;
		}
		return sendAsOptions[0]?.accessToken ?? room.accessToken;
	});

	const roomSeatStates = $derived.by(() => {
		const room = selectedRoomProjection;
		if (!room) {
			return [] as RoomSeatState[];
		}

		const seats = new Map<string, RoomSeatState>();
		const mergeSeat = (seat: RoomSeatState): void => {
			const current = seats.get(seat.actorId);
			seats.set(seat.actorId, {
				...current,
				...seat,
				accessToken: seat.accessToken ?? current?.accessToken,
				grantId: seat.grantId ?? current?.grantId,
			});
		};

		if (room.participantId) {
			mergeSeat({
				actorId: room.participantId,
				role: room.accessRole,
				label: actorDirectoryMap.get(room.participantId)?.label ?? fallbackActorLabel(room.participantId),
				currentAdmin: room.currentAdmin ?? room.accessRole === 'admin',
				online: false,
				focused: room.focused,
				invalidCredential: false,
				hasReadLatestVisible: false,
				accessToken: room.accessToken,
			});
		}

		for (const grant of roomGrants) {
			if (!grant.participantId) {
				continue;
			}
			mergeSeat({
				actorId: grant.participantId,
				role: grant.role,
				label: grant.label,
				currentAdmin: false,
				online: false,
				focused: false,
				invalidCredential: !grant.accessToken,
				hasReadLatestVisible: false,
				accessToken: grant.accessToken,
				grantId: grant.grantId,
			});
		}

		for (const state of room.readStates ?? []) {
			mergeSeat({
				actorId: state.actorId,
				role: state.role,
				label: state.label,
				currentAdmin: state.currentAdmin,
				online: state.online,
				focused: state.focused,
				invalidCredential: state.invalidCredential,
				readAt: state.readAt,
				hasReadLatestVisible: state.hasReadLatestVisible,
			});
		}

		return [...seats.values()].sort((left, right) => {
			if (left.currentAdmin !== right.currentAdmin) {
				return left.currentAdmin ? -1 : 1;
			}
			const roleRank = { admin: 0, member: 1, readonly: 2 } as const;
			if (roleRank[left.role] !== roleRank[right.role]) {
				return roleRank[left.role] - roleRank[right.role];
			}
			return (left.label ?? left.actorId).localeCompare(right.label ?? right.actorId);
		});
	});

	const resolvedRoomSeatStates = $derived.by(() => {
		return roomSeatStates.map((state) => {
			const actor = describeActor(state.actorId, state.label ?? state.actorId);
			return {
				...state,
				actorKind: actor.actorKind,
				label: actor.label,
				subtitle: actor.subtitle,
				iconUrl: actor.iconUrl,
			} satisfies MessageSystemRoomSeatState;
		});
	});

	const roomReadSeatCount = $derived(
		selectedRoomProjection?.readProgress?.readSeatCount ??
			resolvedRoomSeatStates.filter((state) => state.hasReadLatestVisible).length,
	);
	const roomReadTotalSeatCount = $derived(
		Math.max(selectedRoomProjection?.readProgress?.totalSeatCount ?? resolvedRoomSeatStates.length, 1),
	);
	const chatNotice = $derived.by(() => {
		if (routeNotice) {
			return routeNotice;
		}
		const error = selectedRoomSnapshotState.error ?? selectedRoomGrantsState.error ?? roomsState.error;
		if (!error) {
			return null;
		}
		return {
			tone: 'destructive',
			message: error,
		} satisfies WebChatNotice;
	});

	const syncRoomQuery = async (chatId: string): Promise<void> => {
		const queryRoomId = page.url.searchParams.get('roomId') ?? '';
		if (queryRoomId === chatId) {
			return;
		}
		const url = new URL(page.url);
		if (chatId) {
			url.searchParams.set('roomId', chatId);
		} else {
			url.searchParams.delete('roomId');
		}
		await goto(`${url.pathname}${url.searchParams.size > 0 ? `?${url.searchParams.toString()}` : ''}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const selectRoom = (chatId: string): void => {
		selectedRoomId = chatId;
		routeNotice = null;
		void syncRoomQuery(chatId);
	};

	const handleChangeCallerToken = (accessToken: string): void => {
		const room = selectedRoomProjection;
		if (!room) {
			return;
		}
		selectedCallerTokenByRoomId = {
			...selectedCallerTokenByRoomId,
			[room.chatId]: accessToken,
		};
	};

	const handleCreateRoom = async (input: { title?: string; participantIds: string[] }): Promise<void> => {
		const participants = input.participantIds.map((actorId) => ({
			id: actorId,
			label: actorDirectoryMap.get(actorId)?.label,
		}));
		const created = await controller.runtimeStore.createGlobalRoom({
			title: input.title,
			participants,
		});
		routeNotice = null;
		selectRoom(created.chatId);
	};

	const handleSaveRoomTitle = async (title: string): Promise<void> => {
		const room = selectedRoomProjection;
		if (!room) {
			return;
		}
		await controller.runtimeStore.updateGlobalRoom({
			chatId: room.chatId,
			accessToken: room.accessToken,
			patch: { title },
		});
		routeNotice = null;
	};

	const handleArchiveRoom = async (): Promise<void> => {
		const room = selectedRoomProjection;
		if (!room) {
			return;
		}
		await controller.runtimeStore.archiveGlobalRoom({
			chatId: room.chatId,
			accessToken: room.accessToken,
			archivedBy: controller.authSession?.claims.authId ?? 'operator',
		});
		routeNotice = null;
		if (selectedRoomId === room.chatId) {
			selectRoom('');
		}
	};

	const handleDeleteRoom = async (): Promise<void> => {
		const room = selectedRoomProjection;
		if (!room) {
			return;
		}
		await controller.runtimeStore.deleteGlobalRoom({
			chatId: room.chatId,
			accessToken: room.accessToken,
		});
		routeNotice = null;
		if (selectedRoomId === room.chatId) {
			selectRoom('');
		}
	};

	const handleGrantSeat = async (input: {
		participantId: string;
		role: MessageSystemGrantRole;
	}): Promise<void> => {
		const room = selectedRoomProjection;
		const participantId = asRoomActorId(input.participantId);
		if (!room || !participantId) {
			return;
		}
		await controller.runtimeStore.issueGlobalRoomGrant({
			chatId: room.chatId,
			accessToken: room.accessToken,
			role: input.role,
			participantId,
			label: actorDirectoryMap.get(input.participantId)?.label,
		});
		routeNotice = null;
	};

	const handleToggleSeatFocus = async (input: {
		accessToken: string;
		focused: boolean;
	}): Promise<void> => {
		const room = selectedRoomProjection;
		if (!room) {
			return;
		}
		await controller.runtimeStore.focusGlobalRooms({
			op: input.focused ? 'remove' : 'add',
			channels: [{ chatId: room.chatId, accessToken: input.accessToken }],
		});
		routeNotice = null;
	};

	const handleRevokeSeat = async (input: { grantId: string }): Promise<void> => {
		const room = selectedRoomProjection;
		if (!room) {
			return;
		}
		await controller.runtimeStore.revokeGlobalRoomGrant({
			chatId: room.chatId,
			accessToken: room.accessToken,
			grantId: input.grantId,
		});
		routeNotice = null;
	};

	const handleLatestVisibleMessageIdChange = async (messageId: string | null): Promise<void> => {
		const room = selectedRoomProjection;
		const accessToken = selectedCallerToken;
		if (!room || !accessToken) {
			return;
		}
		const markKey = `${room.chatId}:${accessToken}`;
		if (!messageId) {
			if ((latestMarkedReadBySeat[markKey] ?? null) === null) {
				return;
			}
			latestMarkedReadBySeat = {
				...latestMarkedReadBySeat,
				[markKey]: null,
			};
			return;
		}
		if (latestMarkedReadBySeat[markKey] === messageId) {
			return;
		}
		latestMarkedReadBySeat = {
			...latestMarkedReadBySeat,
			[markKey]: messageId,
		};
		try {
			await controller.runtimeStore.markGlobalRoomRead({
				chatId: room.chatId,
				accessToken,
				messageId,
				readAt: Date.now(),
			});
		} catch (error) {
			if ((latestMarkedReadBySeat[markKey] ?? null) !== null) {
				latestMarkedReadBySeat = {
					...latestMarkedReadBySeat,
					[markKey]: null,
				};
			}
			routeNotice = {
				tone: 'destructive',
				message: error instanceof Error ? error.message : String(error),
			};
		}
	};

	const handleSendMessage = async (payload: { text: string; assets: File[] }): Promise<void> => {
		const room = selectedRoomProjection;
		const accessToken = selectedCallerToken;
		if (!room || !accessToken) {
			throw new Error('message-system seat token is unavailable');
		}
		if (payload.assets.length > 0) {
			throw new Error('message-system attachments are not connected yet');
		}
		const result = await controller.runtimeStore.sendGlobalRoomMessage({
			chatId: room.chatId,
			accessToken,
			text: payload.text,
		});
		if (!result.ok) {
			const message = result.reason ?? 'message-system send failed';
			routeNotice = {
				tone: 'destructive',
				message,
			};
			throw new Error(message);
		}
		routeNotice = null;
	};

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalRooms();
		void controller.runtimeStore.hydrateGlobalRooms();
		return () => {
			release();
		};
	});

	$effect(() => {
		const requestedRoomId = page.url.searchParams.get('roomId') ?? '';
		if (requestedRoomId && requestedRoomId !== selectedRoomId) {
			selectedRoomId = requestedRoomId;
		}
	});

	$effect(() => {
		const requestedRoomId = page.url.searchParams.get('roomId') ?? '';
		if (selectedRoomId && rooms.some((room) => room.chatId === selectedRoomId)) {
			return;
		}
		if (requestedRoomId) {
			return;
		}
		const nextRoomId = rooms[0]?.chatId ?? '';
		if (!nextRoomId || nextRoomId === selectedRoomId) {
			return;
		}
		selectedRoomId = nextRoomId;
		void syncRoomQuery(nextRoomId);
	});

	$effect(() => {
		const room = selectedRoomProjection;
		const chatId = room?.chatId;
		if (!chatId) {
			return;
		}
		const releaseSnapshot = controller.runtimeStore.retainGlobalRoomSnapshot(chatId);
		const releaseGrants = controller.runtimeStore.retainGlobalRoomGrants(chatId);
		void controller.runtimeStore.hydrateGlobalRoomSnapshot({
			chatId,
			accessToken: room.accessToken,
			limit: 120,
		});
		void controller.runtimeStore.hydrateGlobalRoomGrants({
			chatId,
			accessToken: room.accessToken,
		});
		return () => {
			releaseSnapshot();
			releaseGrants();
		};
	});

	$effect(() => {
		const room = selectedRoomProjection;
		const accessToken = selectedCallerToken;
		if (!room || !accessToken) {
			return;
		}
		if (selectedCallerTokenByRoomId[room.chatId] === accessToken) {
			return;
		}
		selectedCallerTokenByRoomId = {
			...selectedCallerTokenByRoomId,
			[room.chatId]: accessToken,
		};
	});
</script>

<MessageSystemSurface
	{roomsState}
	{selectedRoomId}
	selectedRoom={selectedRoomProjection}
	initialMessages={selectedRoomSnapshot?.items ?? []}
	routeNotice={chatNotice}
	readSeatCount={roomReadSeatCount}
	readSeatTotal={roomReadTotalSeatCount}
	{sendAsOptions}
	{selectedCallerToken}
	{selectableActors}
	roomSeatStates={resolvedRoomSeatStates}
	onSelectRoom={selectRoom}
	onChangeCallerToken={handleChangeCallerToken}
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
