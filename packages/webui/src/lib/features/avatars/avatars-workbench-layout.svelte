<script lang="ts">
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import FolderKanbanIcon from '@lucide/svelte/icons/folder-kanban';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import { goto } from '$app/navigation';

	import { page } from '$app/state';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import {
		AVATAR_SESSION_TABS_CHANGE_EVENT,
		readAvatarSessionTabIds,
		removeAvatarSessionTabId,
		upsertAvatarSessionTabId,
	} from '$lib/features/avatars/avatar-session-tabs-state';
	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import {
		dismissWorkbenchTabId,
		filterDismissedWorkbenchTabs,
		readDismissedWorkbenchTabIds,
		resolveAdjacentWorkbenchTab,
		restoreWorkbenchTabId,
	} from '$lib/features/navigation/workbench-tab-state';
	import {
		buildAvatarSessionRailItems,
		extractRuntimeSessionId,
	} from '$lib/features/runtime/runtime-shell-state';

	let {
		children,
	}: {
		children?: import('svelte').Snippet;
	} = $props();

	const controller = getAppControllerContext();
	let avatarSessionTabIds = $state<string[]>(readAvatarSessionTabIds());
	let dismissedSessionIds = $state<string[]>(readDismissedWorkbenchTabIds('avatars-runtime'));

	const activeSessionId = $derived(extractRuntimeSessionId(page.url.pathname));
	const runtimeItems = $derived(
		filterDismissedWorkbenchTabs(
			buildAvatarSessionRailItems(controller.runtimeState, {
				activeSessionId,
				openedSessionIds: avatarSessionTabIds,
				resolveSessionIconUrl: (sessionId) => controller.runtimeStore.sessionIconUrl(sessionId),
			}),
			(item) => item.sessionId,
			dismissedSessionIds,
		),
	);

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const syncAvatarSessionTabs = (): void => {
			avatarSessionTabIds = readAvatarSessionTabIds();
		};
		window.addEventListener(AVATAR_SESSION_TABS_CHANGE_EVENT, syncAvatarSessionTabs);
		window.addEventListener('storage', syncAvatarSessionTabs);
		return () => {
			window.removeEventListener(AVATAR_SESSION_TABS_CHANGE_EVENT, syncAvatarSessionTabs);
			window.removeEventListener('storage', syncAvatarSessionTabs);
		};
	});

	$effect(() => {
		if (!activeSessionId) {
			return;
		}
		avatarSessionTabIds = upsertAvatarSessionTabId(avatarSessionTabIds, activeSessionId);
		dismissedSessionIds = restoreWorkbenchTabId('avatars-runtime', dismissedSessionIds, activeSessionId);
	});

	const copyToClipboard = async (value: string): Promise<void> => {
		if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
			return;
		}
		await navigator.clipboard.writeText(value);
	};

	const closeRuntimeTab = async (sessionId: string): Promise<void> => {
		const nextSession = resolveAdjacentWorkbenchTab(runtimeItems, (item) => item.sessionId, sessionId);
		avatarSessionTabIds = removeAvatarSessionTabId(avatarSessionTabIds, sessionId);
		dismissedSessionIds = dismissWorkbenchTabId('avatars-runtime', dismissedSessionIds, sessionId);
		if (activeSessionId !== sessionId) {
			return;
		}
		await goto(nextSession?.href ?? '/avatars/workspace', {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const tabs = $derived.by(() => {
		const fixedTabs = [
			{
				id: 'workspace',
				href: '/avatars/workspace',
				label: 'Workspace',
				icon: FolderKanbanIcon,
				title: 'Workspace',
				description: 'Start avatars and browse the workspace avatar catalog.',
			},
			{
				id: 'history',
				href: '/avatars/history',
				label: 'History',
				icon: HistoryIcon,
				title: 'History',
				description: 'Inspect workspace history and recent session activity.',
			},
			{
				id: 'settings',
				href: '/avatars/settings',
				label: 'Settings',
				icon: Settings2Icon,
				title: 'Workspace settings',
				description: 'Inspect workspace inheritance, source layers, and effective settings.',
			},
		] satisfies WorkbenchTabItem[];

		const runtimeTabs = runtimeItems.map((item) => ({
			id: item.sessionId,
			href: item.href,
			label: item.label,
			avatarLabel: item.label,
			avatarUrl: item.iconUrl,
			badgeLabel: item.unreadCount > 0 ? String(item.unreadCount) : undefined,
			title: `${item.label} · ${item.workspaceName}`,
			description: item.detail,
			closable: true,
			onClose: () => void closeRuntimeTab(item.sessionId),
			menuItems: [
				{
					id: `copy:${item.sessionId}`,
					label: 'Copy session id',
					onSelect: () => void copyToClipboard(item.sessionId),
				},
				{
					id: `close:${item.sessionId}`,
					label: 'Close tab',
					danger: true,
					onSelect: () => void closeRuntimeTab(item.sessionId),
				},
			],
		})) satisfies WorkbenchTabItem[];

		return [...fixedTabs, ...runtimeTabs];
	});

	const activeTabValue = $derived.by(() => {
		if (activeSessionId) {
			return activeSessionId;
		}
		if (page.url.pathname === '/avatars/history') {
			return 'history';
		}
		if (page.url.pathname === '/avatars/settings') {
			return 'settings';
		}
		return 'workspace';
	});
</script>

<div class="h-full" data-testid="avatars-workbench">
	<WorkbenchWindow
		ariaLabel="Avatar workbench tabs"
		value={activeTabValue}
		{tabs}
	>
		<div class="h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
