<script lang="ts">
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import MailPlusIcon from '@lucide/svelte/icons/mail-plus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import SendIcon from '@lucide/svelte/icons/send';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { onMount } from 'svelte';

	import type { GlobalRoomEntry, GlobalRoomGrantEntry, GlobalRoomMessage } from '@agenter/client-sdk';

import { getAppControllerContext } from '$lib/app/controller-context';
import ProfileAvatar from '$lib/components/profile-avatar.svelte';
import ScrollView from '$lib/components/scroll-view.svelte';
	import StatusRing from '$lib/components/status-ring.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import {
		buildActorDirectory,
		buildActorDirectoryMap,
		fallbackActorLabel,
		type ActorDirectoryEntry,
	} from '$lib/features/collaboration/actor-directory';

	const controller = getAppControllerContext();

	let rooms = $state<GlobalRoomEntry[]>([]);
	let selectedRoomId = $state('');
	let selectedRoom = $state<GlobalRoomEntry | null>(null);
	let roomMessages = $state<GlobalRoomMessage[]>([]);
	let roomGrants = $state<GlobalRoomGrantEntry[]>([]);
	let roomLoading = $state(false);
	let roomsLoading = $state(false);
	let grantRole = $state<'admin' | 'member' | 'readonly'>('member');
	let grantParticipantId = $state('');
	let composeText = $state('');
	let sendAsToken = $state('');
	let createDialogOpen = $state(false);
	let createTitle = $state('');
	let createSelection = $state<Record<string, boolean>>({});
	let editTitle = $state('');
	const globalRoomRefreshMs = 2500;

	type RoomSeatState = {
		actorId: string;
		role: 'admin' | 'member' | 'readonly';
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

	const actorDirectory = $derived(
		buildActorDirectory({
			sessions: controller.runtimeState.sessions,
			authActors: controller.authActors,
			profileIconUrl: (reference) => controller.runtimeStore.profileIconUrl(reference ?? ''),
			sessionIconUrl: (sessionId) => (sessionId ? controller.runtimeStore.sessionIconUrl(sessionId) : null),
		}),
	);
	const actorDirectoryMap = $derived(buildActorDirectoryMap(actorDirectory));

	const asRoomActorId = (value: string): `auth:${string}` | `session:${string}` | `system:${string}` | null => {
		return /^((auth|session|system):.+)$/u.test(value)
			? (value as `auth:${string}` | `session:${string}` | `system:${string}`)
			: null;
	};

	const sendAsOptions = $derived.by(() => {
		if (!selectedRoom) {
			return [];
		}
		const options = [
			{
				accessToken: selectedRoom.accessToken,
				participantId: selectedRoom.participantId,
				role: selectedRoom.accessRole,
				label:
					(selectedRoom.participantId
						? actorDirectoryMap.get(selectedRoom.participantId)?.label ?? fallbackActorLabel(selectedRoom.participantId)
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

	const roomSeatStates = $derived.by(() => {
		if (!selectedRoom) {
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

		if (selectedRoom.participantId) {
			mergeSeat({
				actorId: selectedRoom.participantId,
				role: selectedRoom.accessRole,
				label:
					actorDirectoryMap.get(selectedRoom.participantId)?.label ??
					fallbackActorLabel(selectedRoom.participantId),
				currentAdmin: selectedRoom.currentAdmin ?? selectedRoom.accessRole === 'admin',
				online: false,
				focused: selectedRoom.focused,
				invalidCredential: false,
				hasReadLatestVisible: false,
				accessToken: selectedRoom.accessToken,
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

		for (const state of selectedRoom.readStates ?? []) {
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
	const roomReadSeatCount = $derived(
		selectedRoom?.readProgress?.readSeatCount ?? roomSeatStates.filter((state) => state.hasReadLatestVisible).length,
	);
	const roomReadTotalSeatCount = $derived(Math.max(selectedRoom?.readProgress?.totalSeatCount ?? roomSeatStates.length, 1));

	const loadRooms = async (options?: { background?: boolean }): Promise<void> => {
		roomsLoading = !options?.background;
		try {
			rooms = (await controller.runtimeStore.listGlobalRooms()).sort((left, right) => right.updatedAt - left.updatedAt);
			if (!selectedRoomId && rooms[0]) {
				selectedRoomId = rooms[0].chatId;
			}
		} finally {
			roomsLoading = false;
		}
	};

	const loadRoomDetail = async (roomId: string, options?: { background?: boolean }): Promise<void> => {
		roomLoading = !options?.background;
		try {
			const room = rooms.find((entry) => entry.chatId === roomId);
			if (!room) {
				return;
			}
			const snapshot = await controller.runtimeStore.snapshotGlobalRoom({
				chatId: room.chatId,
				accessToken: room.accessToken,
				limit: 120,
			});
			selectedRoom = snapshot.channel;
			editTitle = snapshot.channel.title;
			roomMessages = [...snapshot.items].sort((left, right) => left.createdAt - right.createdAt);
			roomGrants = await controller.runtimeStore.listGlobalRoomGrants({
				chatId: room.chatId,
				accessToken: room.accessToken,
			});
			if (!sendAsOptions.some((option) => option.accessToken === sendAsToken)) {
				sendAsToken = snapshot.channel.accessToken;
			}
			const latestVisibleId = snapshot.channel.readProgress?.latestVisibleMessageId;
			if (latestVisibleId) {
				await controller.runtimeStore.markGlobalRoomRead({
					chatId: room.chatId,
					accessToken: sendAsToken || snapshot.channel.accessToken,
					messageId: latestVisibleId,
					readAt: Date.now(),
				});
			}
		} finally {
			roomLoading = false;
		}
	};

	const refreshSelectedRoom = async (): Promise<void> => {
		if (!selectedRoomId) {
			return;
		}
		await loadRooms();
		await loadRoomDetail(selectedRoomId);
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

	onMount(() => {
		const refreshTimer = window.setInterval(() => {
			if (document.visibilityState === 'hidden') {
				return;
			}
			void loadRooms({ background: true });
			if (selectedRoomId) {
				void loadRoomDetail(selectedRoomId, { background: true });
			}
		}, globalRoomRefreshMs);
		return () => {
			window.clearInterval(refreshTimer);
		};
	});

	$effect(() => {
		void loadRooms();
	});

	$effect(() => {
		if (selectedRoomId) {
			void loadRoomDetail(selectedRoomId);
		}
	});

	$effect(() => {
		if (selectedRoom && !sendAsToken) {
			sendAsToken = selectedRoom.accessToken;
		}
	});
</script>

<div class="grid h-full min-h-0 gap-4 p-4 md:grid-cols-[18rem_minmax(0,1fr)_22rem] md:p-6">
	<Card class="min-h-0 min-w-0 py-0">
		<CardHeader class="gap-2 border-b">
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<CardTitle>Rooms</CardTitle>
					<CardDescription>message-system exposes chat as one channel kind named room.</CardDescription>
				</div>
				<Button
					size="icon-sm"
					variant="outline"
					class="shrink-0"
					onclick={() => (createDialogOpen = true)}
					aria-label="Create room"
				>
					<MailPlusIcon class="size-4" />
				</Button>
			</div>
		</CardHeader>
		<CardContent class="min-h-0 p-0">
			<ScrollView class="h-full" contentClass="divide-y">
				{#if roomsLoading}
					<div class="p-4 text-sm text-muted-foreground">Loading rooms…</div>
				{:else}
					{#each rooms as room (room.chatId)}
						<button
							class={`grid w-full gap-2 px-4 py-4 text-left transition-colors hover:bg-muted/40 ${
								selectedRoomId === room.chatId ? 'bg-primary/5' : ''
							}`}
							onclick={() => {
								selectedRoomId = room.chatId;
							}}
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
						</button>
					{/each}
				{/if}
			</ScrollView>
		</CardContent>
	</Card>

	<Card class="min-h-0 min-w-0 py-0">
		<CardHeader class="gap-2 border-b">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<CardTitle>{selectedRoom?.title ?? 'Room transcript'}</CardTitle>
					<CardDescription>{selectedRoom?.chatId ?? 'Select a room to inspect transcript and send tools/messages.'}</CardDescription>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" size="icon-sm" onclick={async () => {
						const room = selectedRoom;
						if (!room) return;
						await controller.runtimeStore.updateGlobalRoom({
							chatId: room.chatId,
							accessToken: room.accessToken,
							patch: { title: editTitle },
						});
						await refreshSelectedRoom();
					}} aria-label="Save room title">
						<PencilIcon class="size-4" />
					</Button>
					<Button variant="outline" size="icon-sm" onclick={async () => {
						const room = selectedRoom;
						if (!room) return;
						await controller.runtimeStore.archiveGlobalRoom({
							chatId: room.chatId,
							accessToken: room.accessToken,
							archivedBy: controller.authSession?.claims.authId ?? 'operator',
						});
						selectedRoomId = '';
						selectedRoom = null;
						await loadRooms();
					}} aria-label="Archive room">
						<ArchiveIcon class="size-4" />
					</Button>
					<Button variant="outline" size="icon-sm" onclick={async () => {
						const room = selectedRoom;
						if (!room) return;
						await controller.runtimeStore.deleteGlobalRoom({
							chatId: room.chatId,
							accessToken: room.accessToken,
						});
						selectedRoomId = '';
						selectedRoom = null;
						await loadRooms();
					}} aria-label="Delete room">
						<Trash2Icon class="size-4" />
					</Button>
				</div>
			</div>
			{#if selectedRoom}
				<Input bind:value={editTitle} placeholder="Room title" />
			{/if}
		</CardHeader>
		<CardContent class="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] p-0">
			<ScrollView class="h-full" contentClass="grid gap-3 p-4">
				{#if roomLoading}
					<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Loading room transcript…</div>
				{:else if selectedRoom}
					{#each roomMessages as message (message.messageId)}
						{@const actor = describeActor(message.from, message.from)}
						<div class={`grid gap-2 ${message.from === selectedRoom.owner ? '' : ''}`}>
							<div class="flex items-center gap-2">
								<ProfileAvatar label={actor.label} src={actor.iconUrl} class="size-8" />
								<div class="text-xs text-muted-foreground">{actor.label} · {new Date(message.createdAt).toLocaleString()}</div>
							</div>
							<div class="rounded-2xl border bg-muted/30 px-4 py-3 text-sm leading-6">{message.content}</div>
						</div>
					{/each}
				{:else}
					<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Select a room from the left rail.</div>
				{/if}
			</ScrollView>

			<div class="border-t p-4">
				<div class="grid gap-3">
					<div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_14rem]">
						<Textarea bind:value={composeText} class="min-h-28" placeholder="Send a room message…" />
						<div class="grid gap-2">
							<span class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Send as</span>
							<NativeSelect.Root bind:value={sendAsToken}>
								{#each sendAsOptions as option (option.accessToken)}
									<option value={option.accessToken}>{option.label} · {option.role}</option>
								{/each}
							</NativeSelect.Root>
							<Button onclick={async () => {
								if (!selectedRoom || !composeText.trim()) return;
								await controller.runtimeStore.sendGlobalRoomMessage({
									chatId: selectedRoom.chatId,
									accessToken: sendAsToken || selectedRoom.accessToken,
									text: composeText.trim(),
								});
								composeText = '';
								await refreshSelectedRoom();
							}} disabled={!selectedRoom || !composeText.trim()}>
								<SendIcon class="size-4" />
								Send message
							</Button>
						</div>
					</div>
				</div>
			</div>
		</CardContent>
	</Card>

	<Card class="min-h-0 min-w-0 py-0">
		<CardHeader class="gap-2 border-b">
			<CardTitle>Users</CardTitle>
			<CardDescription>Seats, grants, read state, and per-seat focus all belong here.</CardDescription>
		</CardHeader>
		<CardContent class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 p-4">
			<div class="grid gap-2">
				<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Grant access</div>
				<NativeSelect.Root bind:value={grantParticipantId}>
					<option value="">Select actor</option>
					{#each actorDirectory as actor (actor.actorId)}
						<option value={actor.actorId}>{actor.label} · {actor.subtitle ?? actor.actorId}</option>
					{/each}
				</NativeSelect.Root>
				<NativeSelect.Root bind:value={grantRole}>
					<option value="member">member</option>
					<option value="readonly">readonly</option>
					<option value="admin">admin</option>
				</NativeSelect.Root>
				<Button onclick={async () => {
					const room = selectedRoom;
					const participantId = asRoomActorId(grantParticipantId);
					if (!room || !participantId) return;
					await controller.runtimeStore.issueGlobalRoomGrant({
						chatId: room.chatId,
						accessToken: room.accessToken,
						role: grantRole,
						participantId,
						label: actorDirectoryMap.get(grantParticipantId)?.label,
					});
					grantParticipantId = '';
					await refreshSelectedRoom();
				}} disabled={!selectedRoom || !grantParticipantId}>
					Grant seat
				</Button>
			</div>

			<ScrollView class="h-full" contentClass="grid gap-3">
				{#if roomSeatStates.length}
					<Tooltip.Provider>
						<div class="flex items-center justify-end">
							<Tooltip.Root>
								<Tooltip.Trigger>
									<StatusRing
										value={roomReadSeatCount}
										total={roomReadTotalSeatCount}
										label="Read progress"
										class="text-primary"
									/>
								</Tooltip.Trigger>
								<Tooltip.Content class="max-w-sm">
									<div class="grid gap-1 text-xs">
										{#each roomSeatStates as state (state.actorId)}
											<div>{state.label ?? fallbackActorLabel(state.actorId)} · {state.hasReadLatestVisible ? `read @ ${state.readAt ?? 'unknown'}` : 'unread'}</div>
										{/each}
									</div>
								</Tooltip.Content>
							</Tooltip.Root>
						</div>
					</Tooltip.Provider>
				{/if}

				{#if roomSeatStates.length}
					{#each roomSeatStates as state (state.actorId)}
						{@const actor = describeActor(state.actorId, state.label ?? state.actorId)}
						<div class="rounded-2xl border p-3">
							<div class="flex items-center justify-between gap-3">
								<div class="flex min-w-0 items-center gap-3">
									<ProfileAvatar label={actor.label} src={actor.iconUrl} class="size-9" />
									<div class="min-w-0">
										<div class="truncate text-sm font-semibold">{actor.label}</div>
										<div class="truncate text-xs text-muted-foreground">{state.actorId}</div>
									</div>
								</div>
								<div class="rounded-full border px-2 py-1 text-[11px]">{state.role}</div>
							</div>
							<div class="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
								<div>{state.hasReadLatestVisible ? 'Read latest visible' : 'Unread'}</div>
								<div>{state.focused ? 'Focused' : 'Unfocused'}</div>
								{#if state.invalidCredential}
									<div>Credential invalid</div>
								{/if}
							</div>
							<div class="mt-3 flex flex-wrap gap-2">
								{#if state.accessToken}
									<Button
										size="sm"
										variant="outline"
										onclick={async () => {
											const room = selectedRoom;
											if (!room) return;
											await controller.runtimeStore.focusGlobalRooms({
												op: state.focused ? 'remove' : 'add',
												channels: [{ chatId: room.chatId, accessToken: state.accessToken }],
											});
											await refreshSelectedRoom();
										}}
									>
										{state.focused ? 'Unfocus seat' : 'Focus seat'}
									</Button>
								{/if}
								{#if state.grantId}
									<Button
										size="sm"
										variant="outline"
										onclick={async () => {
											const room = selectedRoom;
											const grantId = state.grantId;
											if (!room || !grantId) return;
											await controller.runtimeStore.revokeGlobalRoomGrant({
												chatId: room.chatId,
												accessToken: room.accessToken,
												grantId,
											});
											await refreshSelectedRoom();
										}}
									>
										Revoke
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				{:else if selectedRoom}
					<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
						No room seats are visible yet.
					</div>
				{:else}
					<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
						Select a room to inspect seats and grant management.
					</div>
				{/if}
			</ScrollView>
		</CardContent>
	</Card>
</div>

<Dialog.Root bind:open={createDialogOpen}>
	<Dialog.Content class="sm:max-w-xl">
		<Dialog.Header>
			<Dialog.Title>Create room</Dialog.Title>
			<Dialog.Description>
				room is the concrete chat channel inside message-system. Participants here only declare seat candidates.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-4">
			<label class="grid gap-2 text-sm font-medium">
				<span>Room title</span>
				<Input bind:value={createTitle} placeholder="Ops room" />
			</label>

			<div class="grid gap-2">
				<div class="text-sm font-medium">Participants</div>
				<div class="grid max-h-80 gap-2 overflow-hidden rounded-2xl border p-3">
					<ScrollView class="h-full" contentClass="grid gap-2">
						{#each actorDirectory as actor (actor.actorId)}
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
									<div class="truncate text-xs text-muted-foreground">{actor.subtitle ?? actor.actorId}</div>
								</div>
							</label>
						{/each}
					</ScrollView>
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (createDialogOpen = false)}>Cancel</Button>
			<Button onclick={async () => {
				const participants = Object.entries(createSelection)
					.filter(([, checked]) => checked)
					.map(([actorId]) => ({
						id: actorId,
						label: actorDirectoryMap.get(actorId)?.label,
					}));
				const created = await controller.runtimeStore.createGlobalRoom({
					title: createTitle.trim() || undefined,
					participants,
				});
				createDialogOpen = false;
				createTitle = '';
				createSelection = {};
				await loadRooms();
				selectedRoomId = created.chatId;
			}}>
				Create room
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
