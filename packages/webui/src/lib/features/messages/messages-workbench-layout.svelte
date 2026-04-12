<script lang="ts">
	import { ClipSurface } from '@agenter/svelte-components';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';

	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import WorkbenchTabStrip, {
		type WorkbenchTabItem,
	} from '$lib/features/navigation/workbench-tab-strip.svelte';
	import { setWorkbenchPageToolbarRegistry } from '$lib/features/navigation/workbench-page-toolbar-context.svelte';
	import { readMessageRoomSessionId } from '$lib/features/messages/message-room-location';
	import { resolveMessageRoomTabLabel, resolveMessageRoomTabTitle } from '$lib/features/messages/message-room-tab-label';
	import {
		buildMessageWorkbenchRooms,
		getMessageWorkbenchSessionRoomState,
		resolveMessageWorkbenchRoom,
	} from '$lib/features/messages/message-workbench-room-state';
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
		children?: Snippet;
	} = $props();

	const controller = getAppControllerContext();
	const pageToolbarRegistry = setWorkbenchPageToolbarRegistry();
	let dismissedRoomIds = $state<string[]>(readDismissedWorkbenchTabIds('messages'));

	const activeRoomId = $derived.by(() => {
		const match = /^\/messages\/room\/([^/]+)$/u.exec(page.url.pathname);
		return match ? decodeURIComponent(match[1] ?? '') : null;
	});
	const activeSessionId = $derived(readMessageRoomSessionId(page.url.searchParams));
	const activeSessionRoomState = $derived(
		getMessageWorkbenchSessionRoomState(controller.runtimeState.messageChannelsBySession, activeSessionId),
	);

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalRooms();
		void controller.runtimeStore.hydrateGlobalRooms();
		return () => {
			release();
		};
	});

	$effect(() => {
		const sessionId = activeSessionId;
		if (!sessionId) {
			return;
		}
		void controller.runtimeStore.ensureMessageChannels(sessionId).catch(() => undefined);
	});

	$effect(() => {
		if (!activeRoomId) {
			return;
		}
		dismissedRoomIds = restoreWorkbenchTabId('messages', dismissedRoomIds, activeRoomId);
	});

	const rooms = $derived(
		buildMessageWorkbenchRooms({
			activeRoomId,
			activeSessionId,
			globalRooms: controller.runtimeState.globalRooms.data,
			messageChannelsBySession: controller.runtimeState.messageChannelsBySession,
		}),
	);
	const visibleRooms = $derived(
		filterDismissedWorkbenchTabs(
			rooms,
			(room) => room.chatId,
			dismissedRoomIds,
		),
	);
	const redirectHref = $derived.by(() => {
		if (!controller.runtimeState.globalRooms.loaded) {
			return null;
		}

		if (page.url.pathname === '/messages') {
			const nextRoom = visibleRooms[0] ?? null;
			return nextRoom ? nextRoom.href : '/messages/new';
		}

		if (activeRoomId) {
			const activeSessionRoomPending =
				Boolean(activeSessionId) &&
				(!activeSessionRoomState ||
					activeSessionRoomState.loading ||
					activeSessionRoomState.refreshing ||
					(!activeSessionRoomState.loaded && !activeSessionRoomState.error));
			if (activeSessionRoomPending) {
				return null;
			}

			const activeRoom = resolveMessageWorkbenchRoom({
				chatId: activeRoomId,
				sessionId: activeSessionId,
				globalRooms: controller.runtimeState.globalRooms.data,
				messageChannelsBySession: controller.runtimeState.messageChannelsBySession,
			});
			if (!activeRoom) {
				const nextRoom = visibleRooms.find((room) => room.chatId !== activeRoomId) ?? null;
				return nextRoom ? nextRoom.href : '/messages/new';
			}
		}

		return null;
	});

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
		await goto(nextRoom ? nextRoom.href : '/messages/new', {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const tabs = $derived.by(() => {
		const duplicateTitles = new Set(
			visibleRooms
				.map((room) => resolveMessageRoomTabTitle(room))
				.filter((title, index, values) => values.indexOf(title) !== index),
		);
		const roomTabs = visibleRooms.map((room) => ({
			id: room.chatId,
			href: room.href,
			label: resolveMessageRoomTabLabel(room, duplicateTitles),
			title: resolveMessageRoomTabTitle(room),
			description: room.chatId,
			avatarLabel: resolveMessageRoomTabTitle(room),
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
				icon: PlusIcon,
				title: 'Create room',
				description: 'Create a new global room from a dedicated browser-style tab.',
			},
		] satisfies WorkbenchTabItem[];
	});

	const contentKey = $derived.by(() =>
		activeRoomId ? `${activeRoomId}:${activeSessionId ?? ''}` : page.url.pathname,
	);

	$effect(() => {
		if (!redirectHref || redirectHref === page.url.pathname) {
			return;
		}
		void goto(redirectHref, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	});
</script>

<div class="messages-workbench-window" data-testid="messages-workbench">
	<WorkbenchTabStrip
		ariaLabel="Message room tabs"
		value={activeRoomId ?? 'new-room'}
		{tabs}
		fusedBelow
	/>

	<section
		class="messages-workbench-window__toolbar border-x border-b border-border/65 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_14%)_0%,color-mix(in_srgb,var(--card),white_5%)_58%,color-mix(in_srgb,var(--background),transparent_8%)_100%)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_56%),0_22px_44px_-40px_color-mix(in_srgb,var(--foreground),transparent_16%)]"
		data-workbench-page-toolbar
	>
		<div bind:this={pageToolbarRegistry.host} class="messages-workbench-window__toolbar-host"></div>
	</section>

	<ClipSurface
		class="messages-workbench-window__body rounded-b-[1.35rem] border border-border/65 border-t-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_6%)_0%,var(--card)_16%,color-mix(in_srgb,var(--background),var(--card)_42%)_100%)] shadow-[0_30px_60px_-44px_color-mix(in_srgb,var(--foreground),transparent_18%)]"
		data-workbench-window-body
	>
		<div class="messages-workbench-window__content h-full" data-workbench-window-content>
			{#key contentKey}
				{#if children}
					{@render children()}
				{/if}
			{/key}
		</div>
	</ClipSurface>
</div>

<style>
	.messages-workbench-window {
		display: grid;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		grid-template-rows: auto auto minmax(0, 1fr);
	}

	.messages-workbench-window__toolbar,
	:global(.messages-workbench-window__body),
	.messages-workbench-window__content {
		min-block-size: 0;
		min-inline-size: 0;
	}

	.messages-workbench-window__toolbar {
		block-size: 48px;
		container-type: inline-size;
		container-name: workbench-page-toolbar;
		overflow: clip;
	}

	.messages-workbench-window__toolbar:has(.messages-workbench-window__toolbar-host:empty) {
		display: none;
	}

	.messages-workbench-window__toolbar-host {
		display: block;
		block-size: 100%;
		min-inline-size: 0;
	}

	:global(.messages-workbench-window__body),
	.messages-workbench-window__content {
		block-size: 100%;
	}

</style>
