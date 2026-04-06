<script lang="ts">
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Item from '$lib/components/ui/item/index.js';

	import type {
		MessageSystemGrantRole,
		MessageSystemGrantSeatInput,
		MessageSystemRoomSeatState,
	} from './message-system-surface.types';

	interface Props {
		roomSeatStates: MessageSystemRoomSeatState[];
		onNavigateToUsers: () => void;
		onUpdateSeatRole: (input: MessageSystemGrantSeatInput) => Promise<void>;
	}

	let {
		roomSeatStates,
		onNavigateToUsers,
		onUpdateSeatRole,
	}: Props = $props();

	let roleDrafts = $state<Record<string, MessageSystemGrantRole>>({});
	let busyByActorId = $state<Record<string, boolean>>({});
	let errorByActorId = $state<Record<string, string | null>>({});

	const roleItems = [
		{
			value: 'admin',
			label: 'Admin',
		},
		{
			value: 'member',
			label: 'Member',
		},
		{
			value: 'readonly',
			label: 'Readonly',
		},
	] as const satisfies { value: MessageSystemGrantRole; label: string }[];

	const roleFor = (state: MessageSystemRoomSeatState): MessageSystemGrantRole =>
		roleDrafts[state.actorId] ?? state.role;

	const roleDirty = (state: MessageSystemRoomSeatState): boolean => roleFor(state) !== state.role;

	const roleBusy = (state: MessageSystemRoomSeatState): boolean => busyByActorId[state.actorId] ?? false;

	const roleError = (state: MessageSystemRoomSeatState): string | null => errorByActorId[state.actorId] ?? null;

	const updateRoleDraft = (state: MessageSystemRoomSeatState, role: MessageSystemGrantRole): void => {
		roleDrafts = {
			...roleDrafts,
			[state.actorId]: role,
		};
		errorByActorId = {
			...errorByActorId,
			[state.actorId]: null,
		};
	};

	const applySeatRole = async (state: MessageSystemRoomSeatState): Promise<void> => {
		if (roleBusy(state) || !roleDirty(state)) {
			return;
		}
		busyByActorId = {
			...busyByActorId,
			[state.actorId]: true,
		};
		errorByActorId = {
			...errorByActorId,
			[state.actorId]: null,
		};
		try {
			await onUpdateSeatRole({
				participantId: state.actorId,
				role: roleFor(state),
			});
			const { [state.actorId]: _draft, ...nextDrafts } = roleDrafts;
			roleDrafts = nextDrafts;
			const { [state.actorId]: _error, ...nextErrors } = errorByActorId;
			errorByActorId = nextErrors;
		} catch (error) {
			errorByActorId = {
				...errorByActorId,
				[state.actorId]: error instanceof Error ? error.message : String(error),
			};
		} finally {
			busyByActorId = {
				...busyByActorId,
				[state.actorId]: false,
			};
		}
	};
</script>

<div class="grid auto-rows-max gap-4" data-testid="room-manage-permissions-section">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="grid gap-1">
			<h3 class="text-sm font-semibold">Permissions</h3>
			<p class="text-xs text-muted-foreground">
				Change each user's role inline. Add or revoke users from the Users section.
			</p>
		</div>
		<Button variant="outline" size="sm" onclick={onNavigateToUsers}>Open users</Button>
	</div>

	{#if roomSeatStates.length === 0}
		<Item.Root size="sm" variant="muted" class="grid gap-2 py-8 text-sm text-muted-foreground">
			<div>No room users are available yet.</div>
			<div>Open Users to grant the first seat.</div>
		</Item.Root>
	{:else}
		<div class="grid auto-rows-max gap-2.5">
			{#each roomSeatStates as state (state.actorId)}
				<Item.Root
					size="sm"
					class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
					data-testid={`room-permission-${state.actorId}`}
				>
					<div class="flex min-w-0 items-start gap-3">
						<ProfileAvatar label={state.label} src={state.iconUrl} class="mt-0.5 size-10 rounded-xl" />
						<div class="grid min-w-0 gap-1">
							<div class="flex flex-wrap items-center gap-2">
								<div class="truncate text-sm font-semibold">{state.label}</div>
								{#if state.currentAdmin}
									<Badge
										variant="outline"
										class="rounded-full text-[10px] font-semibold tracking-[0.16em] uppercase"
									>
										Current admin
									</Badge>
								{/if}
								{#if state.invalidCredential}
									<Badge class="rounded-full text-[10px]" variant="destructive">Credential invalid</Badge>
								{/if}
							</div>
							<div class="truncate text-xs text-muted-foreground">{state.subtitle?.trim() || state.actorId}</div>
						</div>
					</div>

					<div class="grid gap-2 lg:justify-items-end">
						<div class="flex flex-wrap gap-1.5">
							{#each roleItems as role (role.value)}
								<Button
									size="sm"
									variant={roleFor(state) === role.value ? 'secondary' : 'ghost'}
									class="rounded-full px-3"
									aria-pressed={roleFor(state) === role.value}
									disabled={roleBusy(state)}
									onclick={() => {
										updateRoleDraft(state, role.value);
									}}
								>
									{role.label}
								</Button>
							{/each}
						</div>

						<div class="flex flex-wrap items-center gap-2">
							{#if roleError(state)}
								<div class="text-xs text-destructive">{roleError(state)}</div>
							{/if}
							{#if roleDirty(state)}
								<Button
									size="sm"
									variant="outline"
									disabled={roleBusy(state)}
									data-testid={`room-permission-apply-${state.actorId}`}
									onclick={() => {
										void applySeatRole(state);
									}}
								>
									{roleBusy(state) ? 'Saving…' : 'Apply'}
								</Button>
							{:else}
								<div class="text-xs text-muted-foreground">Current role</div>
							{/if}
						</div>
					</div>
				</Item.Root>
			{/each}
		</div>
	{/if}
</div>
