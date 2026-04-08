<script lang="ts">
	import type {
		CachedResourceState,
		GlobalRoomActorId,
		GlobalRoomAssetEntry,
		GlobalRoomEntry,
		GlobalRoomGrantEntry,
		GlobalRoomSnapshotOutput,
	} from '@agenter/client-sdk';
	import type { WebChatNotice, WebChatVisibleMessageFact } from '@agenter/web-chat-view';
	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import {
		buildActorDirectory,
		buildActorDirectoryMap,
		fallbackActorLabel,
		isPrincipalActorId,
		isSystemActorId,
		isUserFacingActorId,
		resolveActorKind,
		type ActorDirectoryEntry,
	} from '$lib/features/collaboration/actor-directory';
	import MessageSystemSurface from './message-system-surface.svelte';
	import { resolveRoomViewerActorId } from './message-room-viewer';
	import {
		maybeStartRoomReadAck,
		resolveRoomReadAckKey,
		resolveRoomReadAckProjectionFloor,
		resolveRoomReadAckServerFloor,
		settleRoomReadAckFailure,
		settleRoomReadAckSuccess,
		syncRoomReadAckState,
		type RoomReadAckState,
	} from './room-read-ack';

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
		trackedByLatestVisible: boolean;
		hasReadLatestVisible: boolean;
		accessToken?: string;
		grantId?: string;
	};

	let selectedViewerActorIdByRoomId = $state<Record<string, string>>({});
	let latestMarkedReadBySeat = $state<Record<string, RoomReadAckState>>({});
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
	const selectedRoomChatId = $derived(selectedRoomProjection?.chatId ?? '');
	const selectedRoomAccessToken = $derived(selectedRoomProjection?.accessToken ?? null);
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

	const asRoomActorId = (value: string): GlobalRoomActorId | null =>
		/^(auth|session|system):.+$/u.test(value) || isPrincipalActorId(value)
			? (value as GlobalRoomActorId)
			: null;
	const isUserFacingRoomActorId = (value: string | null | undefined): value is string => isUserFacingActorId(value);

	const describeActor = (actorId: string | undefined, fallback: string): ActorDirectoryEntry => {
		if (actorId && actorDirectoryMap.has(actorId)) {
			const actor = actorDirectoryMap.get(actorId)!;
			return {
				...actor,
				iconUrl:
					actor.iconUrl ??
					(actor.actorKind === 'session'
						? (actor.sessionId ? controller.runtimeStore.sessionIconUrl(actor.sessionId) : null)
						: controller.runtimeStore.profileIconUrl(actor.actorId)),
			};
		}
		return {
			actorId: actorId ?? fallback,
			actorKind: resolveActorKind(actorId ?? fallback),
			label: fallbackActorLabel(actorId ?? fallback),
			subtitle: actorId,
			iconUrl:
				actorId && !isSystemActorId(actorId) ? controller.runtimeStore.profileIconUrl(actorId) : null,
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
				trackedByLatestVisible: false,
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
				trackedByLatestVisible: false,
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
				trackedByLatestVisible: false,
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
				trackedByLatestVisible: state.trackedByLatestVisible,
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
		return resolveRoomViewerActorId({
			storedViewerActorId: selectedViewerActorIdByRoomId[room.chatId] ?? null,
			roomParticipantId: isUserFacingRoomActorId(room.participantId) ? room.participantId : null,
			currentAuthActorId,
			seatActorIds: roomSeatStates.map((state) => state.actorId),
		});
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
			resolvedRoomSeatStates.filter((state) => state.trackedByLatestVisible && state.hasReadLatestVisible).length,
	);
	const roomReadTotalSeatCount = $derived(
		selectedRoomProjection?.readProgress?.totalSeatCount ??
			resolvedRoomSeatStates.filter((state) => state.trackedByLatestVisible).length,
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

	const handleLatestVisibleMessageIdChange = async (
		visibleMessage: WebChatVisibleMessageFact | null,
	): Promise<void> => {
		const room = selectedRoomProjection;
		const viewerActorId = selectedViewerActorId;
		const viewerSeat = viewerActorId
			? resolvedRoomSeatStates.find((state) => state.actorId === viewerActorId)
			: null;
		const accessToken =
			viewerSeat?.accessToken ??
			(viewerActorId && room?.participantId === viewerActorId ? room.accessToken : null);
		if (!room || !accessToken || !viewerActorId) {
			return;
		}
		if (!visibleMessage) {
			return;
		}
		if (visibleMessage.rowId <= 0) {
			return;
		}
		const { messageId, rowId: targetRowId } = visibleMessage;
		const markKey = resolveRoomReadAckKey(room.chatId, viewerActorId);
		const serverFloor = Math.max(
			resolveRoomReadAckServerFloor(selectedRoomSnapshot?.items ?? [], viewerActorId),
			resolveRoomReadAckProjectionFloor(room.readProgress, resolvedRoomSeatStates, viewerActorId),
		);
		const currentAckState = syncRoomReadAckState(
			latestMarkedReadBySeat[markKey],
			serverFloor,
		);
		if (
			currentAckState.ackedRowId !== (latestMarkedReadBySeat[markKey]?.ackedRowId ?? 0) ||
			currentAckState.pendingRowId !== (latestMarkedReadBySeat[markKey]?.pendingRowId ?? null)
		) {
			latestMarkedReadBySeat = {
				...latestMarkedReadBySeat,
				[markKey]: currentAckState,
			};
		}
		const nextAckState = maybeStartRoomReadAck(currentAckState, targetRowId);
		if (!nextAckState) {
			return;
		}
		latestMarkedReadBySeat = {
			...latestMarkedReadBySeat,
			[markKey]: nextAckState,
		};
		try {
			await controller.runtimeStore.markGlobalRoomRead({
				chatId: room.chatId,
				accessToken,
				messageId,
			});
			latestMarkedReadBySeat = {
				...latestMarkedReadBySeat,
				[markKey]: settleRoomReadAckSuccess(latestMarkedReadBySeat[markKey], targetRowId),
			};
		} catch (error) {
			latestMarkedReadBySeat = {
				...latestMarkedReadBySeat,
				[markKey]: settleRoomReadAckFailure(latestMarkedReadBySeat[markKey], targetRowId),
			};
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
			sendAsActorId:
				(selectedViewerActorId ? asRoomActorId(selectedViewerActorId) : null) ?? undefined,
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
		const chatId = selectedRoomChatId;
		const accessToken = selectedRoomAccessToken;
		if (!chatId || !accessToken) {
			return;
		}
		const releaseSnapshot = controller.runtimeStore.retainGlobalRoomSnapshot(chatId);
		const releaseGrants = controller.runtimeStore.retainGlobalRoomGrants(chatId);
		const releaseAssets = controller.runtimeStore.retainGlobalRoomAssets(chatId);
		void controller.runtimeStore.hydrateGlobalRoomSnapshot({
			chatId,
			accessToken,
			limit: 120,
		});
		void controller.runtimeStore.hydrateGlobalRoomGrants({
			chatId,
			accessToken,
		});
		void controller.runtimeStore.hydrateGlobalRoomAssets({
			chatId,
			accessToken,
		});
		return () => {
			releaseSnapshot();
			releaseGrants();
			releaseAssets();
		};
	});

	$effect(() => {
		const chatId = selectedRoomChatId;
		const viewerActorId = selectedViewerActorId;
		if (!chatId || !viewerActorId) {
			return;
		}
		if (selectedViewerActorIdByRoomId[chatId] === viewerActorId) {
			return;
		}
		selectedViewerActorIdByRoomId = {
			...selectedViewerActorIdByRoomId,
			[chatId]: viewerActorId,
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
