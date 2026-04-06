<script lang="ts">
	import type {
		CachedResourceState,
		GlobalRoomAssetEntry,
		GlobalRoomEntry,
		GlobalRoomGrantEntry,
		GlobalRoomSnapshotOutput,
	} from '@agenter/client-sdk';
	import type { WebChatNotice } from '@agenter/web-chat-view';
	import { goto } from '$app/navigation';

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
		MessageSystemRoomAssetItem,
		MessageSystemRoomSeatState,
		MessageSystemSendAsOption,
	} from './message-system-surface.types';

	let {
		roomId,
	}: {
		roomId: string;
	} = $props();

	const controller = getAppControllerContext();

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
	const emptyRoomAssetState: CachedResourceState<GlobalRoomAssetEntry[]> = {
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
		readMessageId?: string;
		readMessageRowId?: number;
		readAt?: number;
		hasReadLatestVisible: boolean;
		accessToken?: string;
		grantId?: string;
	};

	let selectedViewerActorIdByRoomId = $state<Record<string, string>>({});
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
	const rooms = $derived(controller.runtimeState.globalRooms.data);
	const selectedRoom = $derived(rooms.find((room) => room.chatId === roomId) ?? null);
	const selectedRoomSnapshotState = $derived(
		roomId ? (controller.runtimeState.globalRoomSnapshotsById[roomId] ?? emptyRoomSnapshotState) : emptyRoomSnapshotState,
	);
	const selectedRoomSnapshot = $derived(selectedRoomSnapshotState.data);
	const selectedRoomProjection = $derived(selectedRoomSnapshot?.channel ?? selectedRoom ?? null);
	const selectedRoomIconUrl = $derived(
		selectedRoomProjection ? controller.runtimeStore.roomIconUrl(selectedRoomProjection.chatId) : null,
	);
	const selectedRoomGrantsState = $derived(
		roomId ? (controller.runtimeState.globalRoomGrantsById[roomId] ?? emptyRoomGrantState) : emptyRoomGrantState,
	);
	const selectedRoomAssetsState = $derived(
		roomId ? (controller.runtimeState.globalRoomAssetsById[roomId] ?? emptyRoomAssetState) : emptyRoomAssetState,
	);
	const roomGrants = $derived(selectedRoomGrantsState.data);
	const currentAuthActorId = $derived.by(() => {
		const authId = controller.authSession?.claims.authId;
		return authId ? (`auth:${authId}` as const) : null;
	});

	const asRoomActorId = (value: string): `auth:${string}` | `session:${string}` | `system:${string}` | null => {
		return /^((auth|session|system):.+)$/u.test(value)
			? (value as `auth:${string}` | `session:${string}` | `system:${string}`)
			: null;
	};
	const isSystemActorId = (value: string | null | undefined): value is `system:${string}` =>
		Boolean(value?.startsWith('system:'));
	const isUserFacingRoomActorId = (
		value: string | null | undefined,
	): value is `auth:${string}` | `session:${string}` => {
		return Boolean(value) && !isSystemActorId(value);
	};

	const describeActor = (actorId: string | undefined, fallback: string): ActorDirectoryEntry => {
		if (actorId && actorDirectoryMap.has(actorId)) {
			const actor = actorDirectoryMap.get(actorId)!;
			return {
				...actor,
				iconUrl:
					actor.iconUrl ??
					(actor.actorKind === 'session'
						? controller.runtimeStore.sessionIconUrl(actor.actorId.slice('session:'.length))
						: controller.runtimeStore.profileIconUrl(actor.actorId)),
			};
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
			iconUrl:
				actorId?.startsWith('session:')
					? controller.runtimeStore.sessionIconUrl(actorId.slice('session:'.length))
					: actorId
						? controller.runtimeStore.profileIconUrl(actorId)
						: null,
		};
	};

	const sendAsOptions = $derived.by(() => {
		const room = selectedRoomProjection;
		if (!room) {
			return [] as MessageSystemSendAsOption[];
		}

		const grantOptions = roomGrants
			.filter((grant) => Boolean(grant.accessToken) && isUserFacingRoomActorId(grant.participantId))
			.map((grant) => ({
				accessToken: grant.accessToken ?? '',
				participantId: grant.participantId,
				role: grant.role,
				label:
					(grant.participantId ? actorDirectoryMap.get(grant.participantId)?.label : undefined) ??
					grant.label ??
					fallbackActorLabel(grant.participantId ?? grant.grantId),
			}));

		const roomOption = (() => {
			if (!room.accessToken) {
				return null;
			}
			if (isUserFacingRoomActorId(room.participantId)) {
				return {
					accessToken: room.accessToken,
					participantId: room.participantId,
					role: room.accessRole,
					label: actorDirectoryMap.get(room.participantId)?.label ?? fallbackActorLabel(room.participantId),
				} satisfies MessageSystemSendAsOption;
			}
			if (
				currentAuthActorId &&
				!grantOptions.some((option) => option.participantId === currentAuthActorId)
			) {
				return {
					accessToken: room.accessToken,
					participantId: currentAuthActorId,
					role: room.accessRole,
					label: actorDirectoryMap.get(currentAuthActorId)?.label ?? fallbackActorLabel(currentAuthActorId),
				} satisfies MessageSystemSendAsOption;
			}
			return null;
		})();

		return (roomOption ? [roomOption, ...grantOptions] : grantOptions).filter((option) => option.accessToken);
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

		if (isUserFacingRoomActorId(room.participantId)) {
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
		if (
			currentAuthActorId &&
			room.accessToken &&
			!seats.has(currentAuthActorId) &&
			!isUserFacingRoomActorId(room.participantId)
		) {
			mergeSeat({
				actorId: currentAuthActorId,
				role: room.accessRole,
				label: actorDirectoryMap.get(currentAuthActorId)?.label ?? fallbackActorLabel(currentAuthActorId),
				currentAdmin: room.currentAdmin ?? room.accessRole === 'admin',
				online: false,
				focused: room.focused,
				invalidCredential: false,
				hasReadLatestVisible: false,
				accessToken: room.accessToken,
			});
		}

		for (const grant of roomGrants) {
			if (!isUserFacingRoomActorId(grant.participantId)) {
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
			if (isSystemActorId(state.actorId)) {
				continue;
			}
			mergeSeat({
				actorId: state.actorId,
				role: state.role,
				label: state.label,
				currentAdmin: state.currentAdmin,
				online: state.online,
				focused: state.focused,
				invalidCredential: state.invalidCredential,
				readMessageId: state.readMessageId,
				readMessageRowId: state.readMessageRowId,
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

	const selectedViewerActorId = $derived.by(() => {
		const room = selectedRoomProjection;
		if (!room) {
			return null;
		}
		const selected = selectedViewerActorIdByRoomId[room.chatId];
		if (selected && roomSeatStates.some((state) => state.actorId === selected)) {
			return selected;
		}
		return roomSeatStates[0]?.actorId ?? null;
	});

	const selectedCallerToken = $derived.by(() => {
		const room = selectedRoomProjection;
		const viewerActorId = selectedViewerActorId;
		if (!room || !viewerActorId) {
			return null;
		}
		if (room.participantId === viewerActorId) {
			return room.accessToken ?? null;
		}
		return sendAsOptions.find((option) => option.participantId === viewerActorId)?.accessToken ?? null;
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
	const resolvedRoomAssetsState = $derived.by(() => {
		const data = selectedRoomAssetsState.data.map((asset) => {
			const uploader = asset.uploadedByActorId
				? describeActor(asset.uploadedByActorId, fallbackActorLabel(asset.uploadedByActorId))
				: null;
			return {
				...asset,
				uploaderLabel: uploader?.label ?? 'Unknown uploader',
				uploaderSubtitle: uploader?.subtitle ?? (asset.uploadedByActorId ?? 'Historical asset'),
				uploaderIconUrl: uploader?.iconUrl ?? null,
			} satisfies MessageSystemRoomAssetItem;
		});
		return {
			...selectedRoomAssetsState,
			data,
		} satisfies CachedResourceState<MessageSystemRoomAssetItem[]>;
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
		const error = selectedRoomSnapshotState.error ?? selectedRoomGrantsState.error ?? controller.runtimeState.globalRooms.error;
		if (!error) {
			return null;
		}
		return {
			tone: 'destructive',
			message: error,
		} satisfies WebChatNotice;
	});

	const navigateToRoom = async (chatId: string): Promise<void> => {
		await goto(`/messages/room/${encodeURIComponent(chatId)}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const navigateToFallbackRoom = async (removedRoomId?: string): Promise<void> => {
		const nextRoom = rooms.find((room) => room.chatId !== removedRoomId) ?? null;
		if (nextRoom) {
			await navigateToRoom(nextRoom.chatId);
			return;
		}
		await goto('/messages/new', {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const handleChangeViewerActorId = (actorId: string): void => {
		const room = selectedRoomProjection;
		if (!room) {
			return;
		}
		selectedViewerActorIdByRoomId = {
			...selectedViewerActorIdByRoomId,
			[room.chatId]: actorId,
		};
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
		await navigateToFallbackRoom(room.chatId);
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
		await navigateToFallbackRoom(room.chatId);
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
		const viewerActorId = selectedViewerActorId;
		const viewerSeat = viewerActorId
			? resolvedRoomSeatStates.find((state) => state.actorId === viewerActorId)
			: null;
		const accessToken =
			viewerSeat?.accessToken ??
			(viewerActorId && room?.participantId === viewerActorId ? room.accessToken : null);
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
		const uploadedAssets =
			payload.assets.length > 0
				? await controller.runtimeStore.uploadRoomAssets(room.chatId, accessToken, payload.assets)
				: [];
		const result = await controller.runtimeStore.sendGlobalRoomMessage({
			chatId: room.chatId,
			accessToken,
			text: payload.text,
			assetIds: uploadedAssets.map((asset) => asset.assetId),
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
		if (!controller.runtimeState.globalRooms.loaded) {
			return;
		}
		if (selectedRoom || controller.runtimeState.globalRooms.loading) {
			return;
		}
		void navigateToFallbackRoom(roomId);
	});

	$effect(() => {
		const room = selectedRoomProjection;
		const chatId = room?.chatId;
		if (!chatId) {
			return;
		}
		const releaseSnapshot = controller.runtimeStore.retainGlobalRoomSnapshot(chatId);
		const releaseGrants = controller.runtimeStore.retainGlobalRoomGrants(chatId);
		const releaseAssets = controller.runtimeStore.retainGlobalRoomAssets(chatId);
		void controller.runtimeStore.hydrateGlobalRoomSnapshot({
			chatId,
			accessToken: room.accessToken,
			limit: 120,
		});
		void controller.runtimeStore.hydrateGlobalRoomGrants({
			chatId,
			accessToken: room.accessToken,
		});
		void controller.runtimeStore.hydrateGlobalRoomAssets({
			chatId,
			accessToken: room.accessToken,
		});
		return () => {
			releaseSnapshot();
			releaseGrants();
			releaseAssets();
		};
	});

	$effect(() => {
		const room = selectedRoomProjection;
		const viewerActorId = selectedViewerActorId;
		if (!room || !viewerActorId) {
			return;
		}
		if (selectedViewerActorIdByRoomId[room.chatId] === viewerActorId) {
			return;
		}
		selectedViewerActorIdByRoomId = {
			...selectedViewerActorIdByRoomId,
			[room.chatId]: viewerActorId,
		};
	});
</script>

<MessageSystemSurface
	selectedRoom={selectedRoomProjection}
	{selectedRoomIconUrl}
	resolveProfileIconUrl={(reference) => controller.runtimeStore.profileIconUrl(reference)}
	resolveSessionIconUrl={(sessionId) => controller.runtimeStore.sessionIconUrl(sessionId)}
	initialMessages={selectedRoomSnapshot?.items ?? []}
	initialSnapshotResolved={selectedRoomSnapshotState.loaded}
	roomAssetsState={resolvedRoomAssetsState}
	routeNotice={chatNotice}
	readSeatCount={roomReadSeatCount}
	readSeatTotal={roomReadTotalSeatCount}
	{selectedCallerToken}
	{selectedViewerActorId}
	{selectableActors}
	roomSeatStates={resolvedRoomSeatStates}
	onChangeViewerActorId={handleChangeViewerActorId}
	onSaveRoomTitle={handleSaveRoomTitle}
	onArchiveRoom={handleArchiveRoom}
	onDeleteRoom={handleDeleteRoom}
	onGrantSeat={handleGrantSeat}
	onToggleSeatFocus={handleToggleSeatFocus}
	onRevokeSeat={handleRevokeSeat}
	onSendMessage={handleSendMessage}
	onLatestVisibleMessageIdChange={handleLatestVisibleMessageIdChange}
/>
