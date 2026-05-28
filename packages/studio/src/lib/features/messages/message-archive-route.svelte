<script lang="ts">
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Button } from '$lib/components/ui/button/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import { buildMessageRoomHref } from './message-room-location';
	import { buildMessageWorkbenchRooms, splitMessageWorkbenchRooms } from './message-workbench-room-state';

	const controller = getAppControllerContext();

	const roomCatalog = $derived(
		buildMessageWorkbenchRooms({
			globalRooms: controller.runtimeState.globalRooms.data,
			messageChannelsBySession: controller.runtimeState.messageChannelsBySession,
		}),
	);
	const archivedRooms = $derived(splitMessageWorkbenchRooms(roomCatalog).archivedRooms);
	const roomsLoaded = $derived(controller.runtimeState.globalRooms.loaded);
	const roomsLoading = $derived(controller.runtimeState.globalRooms.loading);
	const roomsError = $derived(controller.runtimeState.globalRooms.error);
</script>

<WorkbenchScaffold
	tone="page"
	body="scroll"
	contentClass="divide-y px-0 py-0"
	data-testid="message-archive-route"
>
	{#snippet header()}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="grid gap-1">
				<div class="flex items-center gap-2">
					<ArchiveIcon class="size-4 text-muted-foreground" />
					<h1 class="text-base font-semibold">Room archive</h1>
				</div>
				<p class="text-sm text-muted-foreground">
					Archived rooms keep their transcript and access, but leave the default active list.
				</p>
			</div>
			<div class="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
				{archivedRooms.length} archived
			</div>
		</div>
	{/snippet}

	{#if roomsError}
		<div class="px-5 pt-4 md:px-7">
			<NoticeBanner tone="destructive" message={roomsError} />
		</div>
	{:else if !roomsLoaded && roomsLoading}
		<div class="px-5 py-6 text-sm text-muted-foreground md:px-7">Loading room archive…</div>
	{:else if archivedRooms.length === 0}
		<div class="px-5 py-6 text-sm text-muted-foreground md:px-7">
			No archived rooms are currently retained.
		</div>
	{:else}
		{#each archivedRooms as room (room.chatId)}
			<div class="grid gap-3 px-5 py-4 md:px-7">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0 grid gap-1">
						<div class="truncate text-sm font-semibold">{room.title || room.chatId}</div>
						<div class="truncate text-[11px] text-muted-foreground">{room.chatId}</div>
					</div>
					<div class="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
						{room.source === 'session' ? 'session room' : 'global room'}
					</div>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button
						size="sm"
						variant="outline"
						onclick={() =>
							void goto(room.href || buildMessageRoomHref({ chatId: room.chatId }), {
								noScroll: true,
								keepFocus: true,
							})}
					>
						Open detail
					</Button>
				</div>
			</div>
		{/each}
	{/if}
</WorkbenchScaffold>
