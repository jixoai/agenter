<script lang="ts">
	import { goto } from '$app/navigation';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import { readDismissedWorkbenchTabIds } from '$lib/features/navigation/workbench-tab-state';

	const controller = getAppControllerContext();

	$effect(() => {
		if (!controller.runtimeState.globalRooms.loaded) {
			return;
		}
		const dismissedRoomIds = new Set(readDismissedWorkbenchTabIds('messages'));
		const nextRoom = controller.runtimeState.globalRooms.data.find((room) => !dismissedRoomIds.has(room.chatId));
		const nextHref = nextRoom ? `/messages/room/${encodeURIComponent(nextRoom.chatId)}` : '/messages/new';
		void goto(nextHref, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	});
</script>

<div class="px-4 py-6 text-sm text-muted-foreground">Opening message workbench…</div>
