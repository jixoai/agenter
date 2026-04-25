<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import type { GlobalRoomEntry } from '@agenter/client-sdk';
	import { Scaffold, SplitView } from '@agenter/svelte-components';
	import { onMount } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	import MessageRoomManagePermissions from './message-room-manage-access.svelte';
	import MessageRoomManageOverview from './message-room-manage-overview.svelte';
	import MessageRoomManageShare from './message-room-manage-share.svelte';
	import MessageRoomManageUsers from './message-room-manage-users.svelte';
	import type {
		MessageSystemGrantRole,
		MessageSystemGrantSeatInput,
		MessageSystemManageSection,
		MessageSystemRoomSeatState,
	} from './message-system-surface.types';
	import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';

	interface Props {
		open?: boolean;
		section?: MessageSystemManageSection;
		usersView?: 'list' | 'add';
		selectedRoom: GlobalRoomEntry | null;
		disableManageDialogPortal?: boolean;
		editableTitle: string;
		titleBusy: boolean;
		archiveBusy: boolean;
		deleteBusy: boolean;
		roomSeatStates: MessageSystemRoomSeatState[];
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
		onNavigateToUsers: () => void;
		onUpdateSeatRole: (input: MessageSystemGrantSeatInput) => Promise<void>;
		onSeatFocusClick: (state: MessageSystemRoomSeatState) => void;
		onSeatRevokeClick: (state: MessageSystemRoomSeatState) => void;
		onGrantParticipantIdChange: (value: string) => void;
		onGrantRoleChange: (value: MessageSystemGrantRole) => void;
		onGrantSeat: () => void;
	}

	let {
		open = $bindable(false),
		section = $bindable<MessageSystemManageSection>('overview'),
		usersView = $bindable<'list' | 'add'>('list'),
		selectedRoom,
		disableManageDialogPortal = false,
		editableTitle,
		titleBusy,
		archiveBusy,
		deleteBusy,
		roomSeatStates,
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
		onNavigateToUsers,
		onUpdateSeatRole,
		onSeatFocusClick,
		onSeatRevokeClick,
		onGrantParticipantIdChange,
		onGrantRoleChange,
		onGrantSeat,
	}: Props = $props();

	const sections: Array<{
		id: MessageSystemManageSection;
		label: string;
	}> = [
		{
			id: 'overview',
			label: 'Overview',
		},
		{
			id: 'users',
			label: 'Users',
		},
		{
			id: 'permissions',
			label: 'Permissions',
		},
		{
			id: 'share',
			label: 'Share',
		},
	];
	let compactViewport = $state(false);

	const openSection = (nextSection: MessageSystemManageSection): void => {
		section = nextSection;
		if (nextSection === 'users') {
			usersView = 'list';
		}
	};

	onMount(() => {
		const mediaQuery = window.matchMedia('(max-width: 767.98px)');
		const syncViewport = (): void => {
			compactViewport = mediaQuery.matches;
		};

		syncViewport();
		mediaQuery.addEventListener('change', syncViewport);
		return () => {
			mediaQuery.removeEventListener('change', syncViewport);
		};
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="left-0 top-0 h-svh w-svw max-w-none translate-x-0 translate-y-0 gap-0 rounded-none p-0 sm:left-[50%] sm:top-[50%] sm:h-auto sm:w-full sm:max-w-6xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
		preventScroll={false}
		portalProps={disableManageDialogPortal ? { disabled: true } : undefined}
		showCloseButton={false}
	>
		{#if selectedRoom}
			<Dialog.Header class="sr-only">
				<Dialog.Title>Manage room</Dialog.Title>
				<Dialog.Description>
					Manage overview, users, permissions, and sharing for {selectedRoom.title || selectedRoom.chatId}.
				</Dialog.Description>
			</Dialog.Header>

			<SplitView.Root
				variant="sidebar-content"
				padding="none"
				class="h-full gap-0 sm:h-[min(88vh,56rem)]"
				data-testid="room-manage-shell"
			>
				<SplitView.Sidebar class="border-b md:border-r md:border-b-0" data-testid="room-manage-rail">
					{#if compactViewport}
						<div class="grid gap-3 px-4 py-4">
							<div class="grid gap-2">
								<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Room management</div>
								<div class="text-base font-semibold">{selectedRoom.title || selectedRoom.chatId}</div>
								<div class="break-all text-xs text-muted-foreground">{selectedRoom.chatId}</div>
							</div>
							<Scaffold.ScrollBody
								class="w-full"
								orientation="horizontal"
								contentClass="flex gap-2"
							>
								{#each sections as item (item.id)}
									<Button
										size="sm"
										variant={section === item.id ? 'secondary' : 'ghost'}
										class="shrink-0 rounded-full"
										data-testid={`room-manage-nav-${item.id}`}
										aria-label={`Open ${item.label} section`}
										aria-pressed={section === item.id}
										onclick={() => {
											openSection(item.id);
										}}
									>
										{item.label}
									</Button>
								{/each}
							</Scaffold.ScrollBody>
						</div>
					{:else}
						<Scaffold.Root class="h-full">
							<Scaffold.Header class="border-b px-4 py-4">
								<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Room management</div>
								<div class="mt-2 text-base font-semibold">{selectedRoom.title || selectedRoom.chatId}</div>
								<div class="mt-1 break-all text-xs text-muted-foreground">{selectedRoom.chatId}</div>
							</Scaffold.Header>

							<Scaffold.ScrollBody contentClass="grid auto-rows-max gap-1 p-2">
								{#each sections as item (item.id)}
									<Button
										variant={section === item.id ? 'secondary' : 'ghost'}
										class="h-auto w-full justify-start rounded-xl px-3 py-3 text-left"
										data-testid={`room-manage-nav-${item.id}`}
										aria-label={`Open ${item.label} section`}
										aria-pressed={section === item.id}
										onclick={() => {
											openSection(item.id);
										}}
									>
										<span class="grid min-w-0 justify-items-start gap-1">
											<span>{item.label}</span>
										</span>
									</Button>
								{/each}
							</Scaffold.ScrollBody>
						</Scaffold.Root>
					{/if}
				</SplitView.Sidebar>

				<SplitView.Content class="h-full" data-testid="room-manage-stage">
					<Scaffold.Root class="h-full">
						<Scaffold.Header class="flex justify-end px-4 pt-4 sm:px-6">
							<Dialog.Close
								class="ring-offset-background focus:ring-ring inline-flex size-9 shrink-0 items-center justify-center rounded-md opacity-70 transition-opacity hover:bg-muted hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
							>
								<XIcon class="size-4" />
								<span class="sr-only">Close</span>
							</Dialog.Close>
						</Scaffold.Header>

						<Scaffold.ScrollBody contentClass="grid auto-rows-max gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
						{#if section === 'overview'}
							<MessageRoomManageOverview
								{selectedRoom}
								{editableTitle}
								{titleBusy}
								{archiveBusy}
								{deleteBusy}
								{formatTimestamp}
								onEditableTitleChange={onEditableTitleChange}
								onSaveTitle={onSaveTitle}
								onArchive={onArchive}
								onDelete={onDelete}
							/>
						{:else if section === 'users'}
							<MessageRoomManageUsers
								bind:view={usersView}
								{roomSeatStates}
								{selectableActors}
								{grantParticipantId}
								{grantRole}
								{grantBusy}
								{grantError}
								onSeatFocusClick={onSeatFocusClick}
								onSeatRevokeClick={onSeatRevokeClick}
								onGrantParticipantIdChange={onGrantParticipantIdChange}
								onGrantRoleChange={onGrantRoleChange}
								onGrantSeat={onGrantSeat}
							/>
						{:else if section === 'permissions'}
							<MessageRoomManagePermissions
								{roomSeatStates}
								onNavigateToUsers={onNavigateToUsers}
								onUpdateSeatRole={onUpdateSeatRole}
							/>
						{:else if section === 'share'}
							<MessageRoomManageShare {selectedRoom} {roomSeatStates} />
						{/if}
						</Scaffold.ScrollBody>
					</Scaffold.Root>
				</SplitView.Content>
			</SplitView.Root>
		{:else}
			<div class="p-6 text-sm text-muted-foreground">Select a room first.</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
