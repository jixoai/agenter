<script lang="ts">
	import MailPlusIcon from '@lucide/svelte/icons/mail-plus';
	import { goto } from '$app/navigation';

	import { page } from '$app/state';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import {
		dismissWorkbenchTabId,
		filterDismissedWorkbenchTabs,
		readDismissedWorkbenchTabIds,
		resolveAdjacentWorkbenchTab,
		restoreWorkbenchTabId,
	} from '$lib/features/navigation/workbench-tab-state';

	let {
		children,
	}: {
		children?: import('svelte').Snippet;
	} = $props();

	const controller = getAppControllerContext();
	let dismissedRoomIds = $state<string[]>(readDismissedWorkbenchTabIds('messages'));

	const activeRoomId = $derived.by(() => {
		const match = /^\/messages\/room\/([^/]+)$/u.exec(page.url.pathname);
		return match ? decodeURIComponent(match[1] ?? '') : null;
	});

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalRooms();
		void controller.runtimeStore.hydrateGlobalRooms();
		return () => {
			release();
		};
	});

	$effect(() => {
		if (!activeRoomId) {
			return;
		}
		dismissedRoomIds = restoreWorkbenchTabId('messages', dismissedRoomIds, activeRoomId);
	});

	const visibleRooms = $derived(
		filterDismissedWorkbenchTabs(
			controller.runtimeState.globalRooms.data,
			(room) => room.chatId,
			dismissedRoomIds,
		),
	);

	const copyToClipboard = async (value: string): Promise<void> => {
		if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
			return;
		}
		await navigator.clipboard.writeText(value);
	};

	const closeRoomTab = async (chatId: string): Promise<void> => {
		const nextRoom = resolveAdjacentWorkbenchTab(visibleRooms, (room) => room.chatId, chatId);
		dismissedRoomIds = dismissWorkbenchTabId('messages', dismissedRoomIds, chatId);
		if (activeRoomId !== chatId) {
			return;
		}
		await goto(nextRoom ? `/messages/room/${encodeURIComponent(nextRoom.chatId)}` : '/messages/new', {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const tabs = $derived.by(() => {
		const roomTabs = visibleRooms.map((room) => ({
			id: room.chatId,
			href: `/messages/room/${encodeURIComponent(room.chatId)}`,
			label: room.title || room.chatId,
			title: room.title || room.chatId,
			description: room.chatId,
			avatarLabel: room.title || room.chatId,
			avatarUrl: controller.runtimeStore.roomIconUrl(room.chatId),
			closable: true,
			onClose: () => void closeRoomTab(room.chatId),
			menuItems: [
				{
					id: `copy:${room.chatId}`,
					label: 'Copy room id',
					onSelect: () => void copyToClipboard(room.chatId),
				},
				{
					id: `close:${room.chatId}`,
					label: 'Close tab',
					danger: true,
					onSelect: () => void closeRoomTab(room.chatId),
				},
			],
		})) satisfies WorkbenchTabItem[];

		return [
			...roomTabs,
			{
				id: 'new-room',
				href: '/messages/new',
				label: 'New room',
				icon: MailPlusIcon,
				title: 'Create room',
				description: 'Create a new global room from a dedicated browser-style tab.',
			},
		] satisfies WorkbenchTabItem[];
	});
</script>

<div class="h-full" data-testid="messages-workbench">
	<WorkbenchWindow
		ariaLabel="Message room tabs"
		value={activeRoomId ?? 'new-room'}
		{tabs}
	>
		<div class="h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
