<script lang="ts">
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type { GlobalRoomEntry } from '@agenter/client-sdk';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	interface Props {
		selectedRoom: GlobalRoomEntry;
		editableTitle: string;
		titleBusy: boolean;
		archiveBusy: boolean;
		deleteBusy: boolean;
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
		formatTimestamp,
		onEditableTitleChange,
		onSaveTitle,
		onArchive,
		onDelete,
	}: Props = $props();

	const uid = $props.id();
	const titleInputId = `${uid}-room-title`;
	const lastUpdatedLabel = $derived(formatTimestamp(selectedRoom.updatedAt));
	const archived = $derived(Boolean(selectedRoom.archivedAt));
	const archivedAtLabel = $derived(selectedRoom.archivedAt ? formatTimestamp(selectedRoom.archivedAt) : null);
</script>

<div class="grid auto-rows-max gap-4" data-testid="room-manage-overview-section">
	<Card.Root>
		<Card.Header class="border-b">
			<Card.Title>Room identity</Card.Title>
			<Card.Description>
				{#if archived}
					This room is archived and hidden from the default active list. Last updated {lastUpdatedLabel}.
					{#if archivedAtLabel}
						<span> Archived {archivedAtLabel}.</span>
					{/if}
				{:else}
					Rename the room or archive it when it should leave the default active list. Last updated {lastUpdatedLabel}.
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-4 pt-6">
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
			</Card.Content>
			<Card.Footer class="flex flex-wrap justify-end gap-2 border-t pt-6">
				{#if !archived}
					<Button variant="outline" disabled={archiveBusy} onclick={onArchive}>
						<ArchiveIcon class="size-4" />
						Archive room
					</Button>
				{/if}
				<Button variant="destructive" disabled={deleteBusy} onclick={onDelete}>
					<Trash2Icon class="size-4" />
					Delete room
			</Button>
		</Card.Footer>
	</Card.Root>
</div>
