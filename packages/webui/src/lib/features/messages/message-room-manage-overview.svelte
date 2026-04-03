<script lang="ts">
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type { GlobalRoomEntry } from '@agenter/client-sdk';

	import StatusRing from '$lib/components/status-ring.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	import type { MessageSystemRoomSeatState } from './message-system-surface.types';

	interface Props {
		selectedRoom: GlobalRoomEntry;
		editableTitle: string;
		titleBusy: boolean;
		archiveBusy: boolean;
		deleteBusy: boolean;
		readSeatCount: number;
		readSeatTotal: number;
		roomSeatStates: MessageSystemRoomSeatState[];
		selectedViewerLabel: string;
		formatTimestamp: (value?: number) => string;
		onEditableTitleChange: (value: string) => void;
		onSaveTitle: () => void;
		onArchive: () => void;
		onDelete: () => void;
	}

	let {
		selectedRoom,
		editableTitle,
		titleBusy,
		archiveBusy,
		deleteBusy,
		readSeatCount,
		readSeatTotal,
		roomSeatStates,
		selectedViewerLabel,
		formatTimestamp,
		onEditableTitleChange,
		onSaveTitle,
		onArchive,
		onDelete,
	}: Props = $props();

	const uid = $props.id();
	const titleInputId = `${uid}-room-title`;
	const unreadSeatCount = $derived(Math.max(roomSeatStates.length - readSeatCount, 0));
	const focusedSeatCount = $derived(roomSeatStates.filter((seat) => seat.focused).length);
</script>

<div class="grid auto-rows-max gap-4" data-testid="room-manage-overview-section">
	<Card.Root>
		<Card.Header class="border-b">
			<Card.Action>
				<Badge variant="outline">{selectedRoom.participants.length} participants</Badge>
			</Card.Action>
			<Card.Title>Room identity</Card.Title>
			<Card.Description>Keep the room discoverable, auditable, and easy to distinguish from other global rooms.</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-6 pt-6">
			<div class="grid gap-2">
				<Label for={titleInputId}>Room title</Label>
				<div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
					<Input
						id={titleInputId}
						value={editableTitle}
						placeholder="Room title"
						oninput={(event) => {
							onEditableTitleChange((event.currentTarget as HTMLInputElement).value);
						}}
					/>
					<Button
						variant="outline"
						disabled={editableTitle.trim().length === 0 || titleBusy}
						onclick={onSaveTitle}
					>
						<PencilIcon class="size-4" />
						Save title
					</Button>
				</div>
			</div>

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
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Viewer</div>
					<div class="mt-2 text-sm font-semibold">{selectedViewerLabel}</div>
				</div>
				<div class="rounded-xl border bg-muted/20 px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Unread seats</div>
					<div class="mt-2 text-sm font-semibold">{unreadSeatCount}</div>
				</div>
				<div class="rounded-xl border bg-muted/20 px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Focused seats</div>
					<div class="mt-2 text-sm font-semibold">{focusedSeatCount}</div>
				</div>
			</div>

			<div class="grid gap-3 md:grid-cols-2">
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Room id</div>
					<div class="mt-2 break-all text-sm font-medium">{selectedRoom.chatId}</div>
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated</div>
					<div class="mt-2 text-sm font-medium">{formatTimestamp(selectedRoom.updatedAt)}</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="border-b">
			<Card.Title>Lifecycle controls</Card.Title>
			<Card.Description>Archive when the room should leave the active catalog. Delete only when the room facts are no longer needed.</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-3 pt-6 text-sm text-muted-foreground">
			<p>Archive keeps the room recoverable while removing it from the active operator flow.</p>
			<p>Delete permanently removes the room and its shared transcript from the global catalog.</p>
		</Card.Content>
		<Card.Footer class="flex flex-wrap justify-end gap-2 border-t pt-6">
			<Button variant="outline" disabled={archiveBusy} onclick={onArchive}>
				<ArchiveIcon class="size-4" />
				Archive room
			</Button>
			<Button variant="destructive" disabled={deleteBusy} onclick={onDelete}>
				<Trash2Icon class="size-4" />
				Delete room
			</Button>
		</Card.Footer>
	</Card.Root>
</div>
