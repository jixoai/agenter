<script lang="ts">
	import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';

	import type { MessageSystemGrantRole } from './message-system-surface.types';

	interface Props {
		selectableActors: ActorDirectoryEntry[];
		grantParticipantId: string;
		grantRole: MessageSystemGrantRole;
		grantBusy: boolean;
		grantError: string | null;
		onGrantParticipantIdChange: (value: string) => void;
		onGrantRoleChange: (value: MessageSystemGrantRole) => void;
	}

	let {
		selectableActors,
		grantParticipantId,
		grantRole,
		grantBusy,
		grantError,
		onGrantParticipantIdChange,
		onGrantRoleChange,
	}: Props = $props();

	const uid = $props.id();
</script>

<div class="grid auto-rows-max gap-4" data-testid="room-manage-access-section">
	<Card.Root>
		<Card.Header class="border-b">
			<Card.Title>Grant room access</Card.Title>
			<Card.Description>Choose one actor from the auth or avatar directory, then assign the minimum role required for this room.</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-4 pt-6">
			<div class="grid gap-2">
				<Label for={`${uid}-actor`}>Grant actor</Label>
				<NativeSelect.Root
					id={`${uid}-actor`}
					aria-label="Grant actor"
					wrapperClass="w-full"
					value={grantParticipantId}
					onchange={(event) => {
						onGrantParticipantIdChange((event.currentTarget as HTMLSelectElement).value);
					}}
				>
					<option value="">Select actor</option>
					{#each selectableActors as actor (actor.actorId)}
						<option value={actor.actorId}>{actor.label} · {actor.subtitle ?? actor.actorId}</option>
					{/each}
				</NativeSelect.Root>
			</div>

			<div class="grid gap-2">
				<Label for={`${uid}-role`}>Grant role</Label>
				<NativeSelect.Root
					id={`${uid}-role`}
					aria-label="Grant role"
					wrapperClass="w-full"
					value={grantRole}
					onchange={(event) => {
						onGrantRoleChange((event.currentTarget as HTMLSelectElement).value as MessageSystemGrantRole);
					}}
				>
					<option value="member">member</option>
					<option value="readonly">readonly</option>
					<option value="admin">admin</option>
				</NativeSelect.Root>
			</div>

			{#if grantError}
				<div class="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
					{grantError}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="border-b">
			<Card.Title>Role guidance</Card.Title>
			<Card.Description>Keep the room orthogonal by choosing the role that matches the least amount of authority needed.</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-3 pt-6 text-sm text-muted-foreground">
			<div class="rounded-xl border px-4 py-3">
				<div class="font-medium text-foreground">readonly</div>
				<div class="mt-1">Can read the transcript and participate in read-state progress without changing room ownership.</div>
			</div>
			<div class="rounded-xl border px-4 py-3">
				<div class="font-medium text-foreground">member</div>
				<div class="mt-1">Can actively work inside the room and use the room token for message operations.</div>
			</div>
			<div class="rounded-xl border px-4 py-3">
				<div class="font-medium text-foreground">admin</div>
				<div class="mt-1">Can operate the room as a manager and should be used sparingly.</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
