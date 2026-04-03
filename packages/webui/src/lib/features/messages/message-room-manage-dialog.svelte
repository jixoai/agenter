<script lang="ts">
	import type { GlobalRoomEntry } from '@agenter/client-sdk';

	import StatusRing from '$lib/components/status-ring.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import ScrollView from '$lib/components/scroll-view.svelte';

	import MessageRoomManageAccess from './message-room-manage-access.svelte';
	import MessageRoomManageOverview from './message-room-manage-overview.svelte';
	import MessageRoomManageUsers from './message-room-manage-users.svelte';
	import type {
		MessageSystemGrantRole,
		MessageSystemManageSection,
		MessageSystemRoomSeatState,
	} from './message-system-surface.types';
	import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';

	interface Props {
		open?: boolean;
		section?: MessageSystemManageSection;
		selectedRoom: GlobalRoomEntry | null;
		disableManageDialogPortal?: boolean;
		editableTitle: string;
		titleBusy: boolean;
		archiveBusy: boolean;
		deleteBusy: boolean;
		readSeatCount: number;
		readSeatTotal: number;
		roomSeatStates: MessageSystemRoomSeatState[];
		selectedViewerLabel: string;
		selectableActors: ActorDirectoryEntry[];
		grantParticipantId: string;
		grantRole: MessageSystemGrantRole;
		grantBusy: boolean;
		grantError: string | null;
		formatTimestamp: (value?: number) => string;
		onEditableTitleChange: (value: string) => void;
		onSaveTitle: () => void;
		onArchive: () => void;
		onDelete: () => void;
		onSeatFocusClick: (state: MessageSystemRoomSeatState) => void;
		onSeatRevokeClick: (state: MessageSystemRoomSeatState) => void;
		onGrantParticipantIdChange: (value: string) => void;
		onGrantRoleChange: (value: MessageSystemGrantRole) => void;
		onGrantSeat: () => void;
	}

	let {
		open = $bindable(false),
		section = $bindable<MessageSystemManageSection>('overview'),
		selectedRoom,
		disableManageDialogPortal = false,
		editableTitle,
		titleBusy,
		archiveBusy,
		deleteBusy,
		readSeatCount,
		readSeatTotal,
		roomSeatStates,
		selectedViewerLabel,
		selectableActors,
		grantParticipantId,
		grantRole,
		grantBusy,
		grantError,
		formatTimestamp,
		onEditableTitleChange,
		onSaveTitle,
		onArchive,
		onDelete,
		onSeatFocusClick,
		onSeatRevokeClick,
		onGrantParticipantIdChange,
		onGrantRoleChange,
		onGrantSeat,
	}: Props = $props();

	const sections: Array<{
		id: MessageSystemManageSection;
		label: string;
		description: string;
	}> = [
		{
			id: 'overview',
			label: 'Overview',
			description: 'Identity, read posture, and lifecycle controls.',
		},
		{
			id: 'users',
			label: 'Users',
			description: 'Visible seats, read progress, focus, and runtime posture.',
		},
		{
			id: 'access',
			label: 'Access',
			description: 'Grant and shape who can operate inside the room.',
		},
	];
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="left-0 top-0 h-svh w-svw max-w-none translate-x-0 translate-y-0 gap-0 rounded-none p-0 sm:left-[50%] sm:top-[50%] sm:h-auto sm:w-full sm:max-w-6xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
		portalProps={disableManageDialogPortal ? { disabled: true } : undefined}
	>
		{#if selectedRoom}
			<Dialog.Header class="sr-only">
				<Dialog.Title>Manage room</Dialog.Title>
				<Dialog.Description>
					Manage overview, users, and access for {selectedRoom.title || selectedRoom.chatId}.
				</Dialog.Description>
			</Dialog.Header>

			<div
				class="grid h-full grid-rows-[auto_1fr] sm:h-[min(88vh,56rem)] md:grid-cols-[18rem_minmax(0,1fr)] md:grid-rows-none"
				data-testid="room-manage-shell"
			>
				<aside class="border-b md:border-r md:border-b-0" data-testid="room-manage-rail">
					<div class="grid gap-3 px-4 py-4 md:hidden">
						<div class="grid gap-2">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Room management</div>
							<div class="flex flex-wrap items-center gap-2">
								<div class="text-base font-semibold">{selectedRoom.title || selectedRoom.chatId}</div>
								<Badge variant="outline">{readSeatCount}/{readSeatTotal} read</Badge>
							</div>
							<div class="break-all text-xs text-muted-foreground">{selectedRoom.chatId}</div>
						</div>

						<ScrollView class="w-full" orientation="horizontal" contentClass="flex gap-2">
							{#each sections as item (item.id)}
								<Button
									size="sm"
									variant={section === item.id ? 'secondary' : 'ghost'}
									class="shrink-0 rounded-full"
									aria-pressed={section === item.id}
									onclick={() => {
										section = item.id;
									}}
								>
									{item.label}
								</Button>
							{/each}
						</ScrollView>
					</div>

					<div class="hidden h-full md:grid md:grid-rows-[auto_1fr_auto]">
						<div class="border-b px-4 py-4">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Room management</div>
							<div class="mt-2 text-base font-semibold">{selectedRoom.title || selectedRoom.chatId}</div>
							<div class="mt-1 break-all text-xs text-muted-foreground">{selectedRoom.chatId}</div>
						</div>

						<ScrollView class="h-full" contentClass="grid auto-rows-max gap-2 p-3">
							{#each sections as item (item.id)}
								<Button
									variant={section === item.id ? 'secondary' : 'ghost'}
									class="h-auto w-full justify-start rounded-xl px-3 py-3 text-left"
									aria-pressed={section === item.id}
									onclick={() => {
										section = item.id;
									}}
								>
									<span class="grid justify-items-start gap-1">
										<span>{item.label}</span>
										<span class="text-xs font-normal text-muted-foreground">{item.description}</span>
									</span>
								</Button>
							{/each}
						</ScrollView>

						<div class="grid gap-2 border-t px-4 py-4">
							<div class="flex items-center gap-3">
								<StatusRing
									value={readSeatCount}
									total={Math.max(readSeatTotal, 1)}
									label={`${readSeatCount}/${readSeatTotal} seats read`}
									class="text-primary"
								/>
								<div class="grid gap-1">
									<div class="text-sm font-medium">{readSeatCount}/{readSeatTotal} seats read</div>
									<div class="text-xs text-muted-foreground">{roomSeatStates.length} visible seats</div>
								</div>
							</div>
						</div>
					</div>
				</aside>

				<div class="grid h-full grid-rows-[auto_1fr]" data-testid="room-manage-stage">
					<div class="border-b px-6 py-5">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="grid gap-2">
								<div class="flex flex-wrap items-center gap-2">
									<h2 class="text-lg font-semibold">{selectedRoom.title || selectedRoom.chatId}</h2>
									<Badge variant="outline">{sections.find((item) => item.id === section)?.label}</Badge>
									<Badge variant="outline" class="md:hidden">{selectedRoom.participants.length} participants</Badge>
								</div>
								<p class="hidden text-sm text-muted-foreground md:block">
									Room administration stays in this dialog so the transcript surface remains chat-first.
								</p>
							</div>
							{#if section === 'access'}
								<Button disabled={!grantParticipantId || grantBusy} onclick={onGrantSeat}>Grant seat</Button>
							{:else}
								<div class="hidden gap-2 text-sm text-muted-foreground sm:text-right md:grid">
									<div>{selectedRoom.participants.length} participants declared</div>
									<div>Updated {formatTimestamp(selectedRoom.updatedAt)}</div>
								</div>
							{/if}
						</div>
					</div>

					<ScrollView class="h-full" contentClass="grid auto-rows-max gap-4 p-6">
						{#if section === 'overview'}
							<MessageRoomManageOverview
								{selectedRoom}
								{editableTitle}
								{titleBusy}
								{archiveBusy}
								{deleteBusy}
								{readSeatCount}
								{readSeatTotal}
								{roomSeatStates}
								{selectedViewerLabel}
								{formatTimestamp}
								onEditableTitleChange={onEditableTitleChange}
								onSaveTitle={onSaveTitle}
								onArchive={onArchive}
								onDelete={onDelete}
							/>
						{:else if section === 'users'}
							<MessageRoomManageUsers
								{roomSeatStates}
								{readSeatCount}
								{readSeatTotal}
								{formatTimestamp}
								onSeatFocusClick={onSeatFocusClick}
								onSeatRevokeClick={onSeatRevokeClick}
							/>
						{:else}
							<MessageRoomManageAccess
								{selectableActors}
								{grantParticipantId}
								{grantRole}
								{grantBusy}
								{grantError}
								onGrantParticipantIdChange={onGrantParticipantIdChange}
								onGrantRoleChange={onGrantRoleChange}
							/>
						{/if}
					</ScrollView>
				</div>
			</div>
		{:else}
			<div class="p-6 text-sm text-muted-foreground">Select a room first.</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
