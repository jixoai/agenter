<script lang="ts">
	import type { MessageSystemRoomSeatState } from './message-system-surface.types';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import StatusRing from '$lib/components/status-ring.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	interface Props {
		roomSeatStates: MessageSystemRoomSeatState[];
		readSeatCount: number;
		readSeatTotal: number;
		formatTimestamp: (value?: number) => string;
		onSeatFocusClick: (state: MessageSystemRoomSeatState) => void;
		onSeatRevokeClick: (state: MessageSystemRoomSeatState) => void;
	}

	let {
		roomSeatStates,
		readSeatCount,
		readSeatTotal,
		formatTimestamp,
		onSeatFocusClick,
		onSeatRevokeClick,
	}: Props = $props();

	const focusedSeatCount = $derived(roomSeatStates.filter((seat) => seat.focused).length);
	const onlineSeatCount = $derived(roomSeatStates.filter((seat) => seat.online).length);
	const invalidSeatCount = $derived(roomSeatStates.filter((seat) => seat.invalidCredential).length);
</script>

<div class="grid auto-rows-max gap-4" data-testid="room-manage-users-section">
	<Card.Root>
		<Card.Header class="border-b">
			<Card.Title>Room readers and operators</Card.Title>
			<Card.Description>Use this view to inspect read progress, focus posture, and current runtime availability for every visible seat.</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-4 pt-6">
			<div class="grid gap-3 md:grid-cols-[auto_repeat(3,minmax(0,1fr))]">
				<div class="flex items-center">
					<StatusRing
						value={readSeatCount}
						total={Math.max(readSeatTotal, 1)}
						label={`${readSeatCount}/${readSeatTotal} seats read`}
						class="text-primary"
					/>
				</div>
				<div class="rounded-xl border bg-muted/20 px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Focused seats</div>
					<div class="mt-2 text-sm font-semibold">{focusedSeatCount}</div>
				</div>
				<div class="rounded-xl border bg-muted/20 px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Online seats</div>
					<div class="mt-2 text-sm font-semibold">{onlineSeatCount}</div>
				</div>
				<div class="rounded-xl border bg-muted/20 px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Credential warnings</div>
					<div class="mt-2 text-sm font-semibold">{invalidSeatCount}</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	{#if roomSeatStates.length === 0}
		<Card.Root>
			<Card.Content class="py-8 text-sm text-muted-foreground">No room seats are visible yet.</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-3 lg:grid-cols-2">
			{#each roomSeatStates as state (state.actorId)}
				<Card.Root data-testid={`room-seat-${state.actorId}`}>
					<Card.Header class="border-b">
						<Card.Action>
							<Badge variant="outline" data-testid={`room-seat-role-${state.actorId}`}>{state.role}</Badge>
						</Card.Action>
						<div class="flex items-start gap-3">
							<ProfileAvatar label={state.label} src={state.iconUrl} class="size-10" />
							<div class="grid gap-1">
								<Card.Title>{state.label}</Card.Title>
								<Card.Description>{state.subtitle ?? state.actorId}</Card.Description>
							</div>
						</div>
					</Card.Header>
					<Card.Content class="grid gap-3 pt-6">
						<div class="flex flex-wrap gap-2">
							<Badge variant={state.hasReadLatestVisible ? 'secondary' : 'outline'}>
								{state.hasReadLatestVisible ? `Read @ ${formatTimestamp(state.readAt)}` : 'Unread'}
							</Badge>
							<Badge variant={state.focused ? 'default' : 'outline'}>
								{state.focused ? 'Focused' : 'Unfocused'}
							</Badge>
							<Badge variant={state.online ? 'secondary' : 'outline'}>
								{state.online ? 'Online' : 'Offline'}
							</Badge>
							{#if state.invalidCredential}
								<Badge variant="destructive">Credential invalid</Badge>
							{/if}
						</div>
					</Card.Content>
					<Card.Footer class="flex flex-wrap justify-end gap-2 border-t pt-6">
						{#if state.accessToken}
							<Button size="sm" variant="outline" onclick={() => onSeatFocusClick(state)}>
								{state.focused ? 'Unfocus seat' : 'Focus seat'}
							</Button>
						{/if}
						{#if state.grantId}
							<Button size="sm" variant="outline" onclick={() => onSeatRevokeClick(state)}>
								Revoke
							</Button>
						{/if}
					</Card.Footer>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
