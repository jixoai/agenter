<script lang="ts">
	import CircleEllipsisIcon from '@lucide/svelte/icons/circle-ellipsis';

	import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	import type {
		MessageSystemGrantRole,
		MessageSystemRoomSeatState,
	} from './message-system-surface.types';

	interface Props {
		roomSeatStates: MessageSystemRoomSeatState[];
		selectableActors: ActorDirectoryEntry[];
		grantParticipantId: string;
		grantRole: MessageSystemGrantRole;
		grantBusy: boolean;
		grantError: string | null;
		onSeatFocusClick: (state: MessageSystemRoomSeatState) => void;
		onSeatRevokeClick: (state: MessageSystemRoomSeatState) => void;
		onGrantParticipantIdChange: (value: string) => void;
		onGrantRoleChange: (value: MessageSystemGrantRole) => void;
		onGrantSeat: () => void;
		view?: 'list' | 'add';
	}

	let {
		roomSeatStates,
		selectableActors,
		grantParticipantId,
		grantRole,
		grantBusy,
		grantError,
		onSeatFocusClick,
		onSeatRevokeClick,
		onGrantParticipantIdChange,
		onGrantRoleChange,
		onGrantSeat,
		view = $bindable<'list' | 'add'>('list'),
	}: Props = $props();

	const uid = $props.id();
	const roleItems = [
		{ value: 'member', label: 'member' },
		{ value: 'readonly', label: 'readonly' },
		{ value: 'admin', label: 'admin' },
	] as const satisfies { value: MessageSystemGrantRole; label: string }[];
	const isGrantRole = (value: string): value is MessageSystemGrantRole =>
		roleItems.some((item) => item.value === value);
	type SeatAction = {
		id: string;
		label: string;
		tone?: 'default' | 'destructive';
		onSelect: () => void;
	};
	let previousGrantBusy = false;

	$effect(() => {
		if (previousGrantBusy && !grantBusy && !grantError) {
			view = 'list';
		}
		previousGrantBusy = grantBusy;
	});

	const actorItems = $derived.by(() => [
		{ value: '', label: 'Select actor' },
		...selectableActors.map((actor) => ({
			value: actor.actorId,
			label: `${actor.label} · ${actor.subtitle ?? actor.actorId}`,
		})),
	]);
	const selectedActorLabel = $derived(
		actorItems.find((item) => item.value === grantParticipantId)?.label ?? 'Select actor',
	);
	const selectedRoleLabel = $derived(
		roleItems.find((item) => item.value === grantRole)?.label ?? 'member',
	);

	const describeSeatIdentity = (state: MessageSystemRoomSeatState): string =>
		state.subtitle?.trim() || state.actorId;

	const describeSeatActionTarget = (state: MessageSystemRoomSeatState): string =>
		state.subtitle ? `${state.label} (${state.subtitle})` : state.label;

	const resolveSeatActions = (state: MessageSystemRoomSeatState): SeatAction[] => {
		const actions: SeatAction[] = [];

		if (state.accessToken) {
			actions.push({
				id: `${state.actorId}:focus`,
				label: state.focused ? 'Unfocus seat' : 'Focus seat',
				onSelect: () => onSeatFocusClick(state),
			});
		}

		if (state.grantId) {
			actions.push({
				id: `${state.actorId}:revoke`,
				label: 'Revoke user',
				tone: 'destructive',
				onSelect: () => onSeatRevokeClick(state),
			});
		}

		return actions;
	};
</script>

<div class="grid auto-rows-max gap-4" data-testid="room-manage-users-section">
	<div class="grid gap-1">
		<h3 class="text-sm font-semibold">Room users</h3>
		<p class="text-xs text-muted-foreground">List the current seat grants or add another actor to this room.</p>
	</div>

	<Tabs.Root bind:value={view} class="gap-4">
		<Tabs.List class="grid w-full max-w-sm grid-cols-2">
			<Tabs.Trigger value="list">List</Tabs.Trigger>
			<Tabs.Trigger value="add">Add</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="list" class="grid gap-3">
			<div class="flex justify-end">
				<Button
					variant="outline"
					size="sm"
					onclick={() => {
						view = 'add';
					}}
				>
					Add user
				</Button>
			</div>

			{#if roomSeatStates.length === 0}
				<Item.Root variant="muted" class="grid gap-2 py-8 text-sm text-muted-foreground">
					<div>No room users are visible yet.</div>
					<div>Use the add tab to grant the first seat.</div>
				</Item.Root>
			{:else}
				<div class="grid auto-rows-max gap-2.5">
					{#each roomSeatStates as state (state.actorId)}
						{@const seatActions = resolveSeatActions(state)}
						<Item.Root data-testid={`room-seat-${state.actorId}`}>
							<ProfileAvatar label={state.label} src={state.iconUrl} class="mt-0.5 size-10 rounded-xl" />
							<div class="min-w-0 flex-1">
								<div class="flex items-start gap-3">
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-2">
											<div class="truncate text-sm font-semibold">{state.label}</div>
											<Badge
												variant="outline"
												class="rounded-full text-[10px] font-semibold tracking-[0.16em] uppercase"
												data-testid={`room-seat-role-${state.actorId}`}
											>
												{state.role}
											</Badge>
										</div>
										<div class="mt-1 truncate text-xs text-muted-foreground">
											{describeSeatIdentity(state)}
										</div>
									</div>
									{#if seatActions.length > 0}
										<DropdownMenu.Root>
											<DropdownMenu.Trigger>
												{#snippet child({ props })}
													<Button
														{...props}
														type="button"
														size="icon-sm"
														variant="ghost"
														class="rounded-full text-muted-foreground hover:text-foreground data-[state=open]:bg-accent"
														aria-label={`Seat actions for ${describeSeatActionTarget(state)}`}
														title={`Seat actions for ${describeSeatActionTarget(state)}`}
													>
														<CircleEllipsisIcon class="size-4" />
													</Button>
												{/snippet}
											</DropdownMenu.Trigger>
											<DropdownMenu.Content align="end" sideOffset={6}>
												{#each seatActions as action (action.id)}
													<DropdownMenu.Item
														variant={action.tone === 'destructive' ? 'destructive' : 'default'}
														onclick={() => action.onSelect()}
													>
														{action.label}
													</DropdownMenu.Item>
												{/each}
											</DropdownMenu.Content>
										</DropdownMenu.Root>
									{/if}
								</div>
								<div class="mt-3 flex flex-wrap gap-1.5">
									<Badge
										class="rounded-full text-[11px]"
										variant={state.hasReadLatestVisible ? 'secondary' : 'outline'}
									>
										{state.trackedByLatestVisible
											? state.hasReadLatestVisible
												? 'Read'
												: 'Unread'
											: 'Joined later'}
									</Badge>
									<Badge
										class="rounded-full text-[11px]"
										variant={state.focused ? 'default' : 'outline'}
									>
										{state.focused ? 'Focused' : 'Unfocused'}
									</Badge>
									<Badge
										class="rounded-full text-[11px]"
										variant={state.online ? 'secondary' : 'outline'}
									>
										{state.online ? 'Online' : 'Offline'}
									</Badge>
									{#if state.invalidCredential}
										<Badge class="rounded-full text-[11px]" variant="destructive">
											Credential invalid
										</Badge>
									{/if}
								</div>
							</div>
						</Item.Root>
					{/each}
				</div>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="add" class="grid gap-3">
			<div class="grid gap-1">
				<div class="text-sm font-semibold">Add user</div>
				<p class="text-xs text-muted-foreground">
					Grant one actor a room seat and the smallest role they need.
				</p>
			</div>

			<Card.Root>
				<Card.Content class="grid gap-4 pt-6">
					<div class="grid gap-2">
						<Label for={`${uid}-actor`}>Grant actor</Label>
						<Select.Root
							type="single"
							items={actorItems}
							value={grantParticipantId}
							onValueChange={(value) => {
								onGrantParticipantIdChange(value);
							}}
						>
							<Select.Trigger id={`${uid}-actor`} aria-label="Grant actor" class="w-full">
								{selectedActorLabel}
							</Select.Trigger>
							<Select.Content>
								{#each actorItems as item (item.value)}
									<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="grid gap-2">
						<Label for={`${uid}-role`}>Grant role</Label>
						<Select.Root
							type="single"
							items={roleItems}
							value={grantRole}
							onValueChange={(value) => {
								if (isGrantRole(value)) {
									onGrantRoleChange(value);
								}
							}}
						>
							<Select.Trigger id={`${uid}-role`} aria-label="Grant role" class="w-full">
								{selectedRoleLabel}
							</Select.Trigger>
							<Select.Content>
								{#each roleItems as item (item.value)}
									<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					{#if grantError}
						<div class="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{grantError}
						</div>
					{/if}
				</Card.Content>
				<Card.Footer class="justify-end border-t pt-6">
					<Button disabled={!grantParticipantId || grantBusy} onclick={onGrantSeat}>Grant seat</Button>
				</Card.Footer>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
