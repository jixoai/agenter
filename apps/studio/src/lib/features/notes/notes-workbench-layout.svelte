<script lang="ts">
	import NotebookTextIcon from '@lucide/svelte/icons/notebook-text';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import { resolveAdjacentWorkbenchTab } from '$lib/features/navigation/workbench-tab-state';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import {
		NOTES_AVATAR_TABS_CHANGE_EVENT,
		readNotesAvatarTabs,
		removeNotesAvatarTab,
		upsertNotesAvatarTab,
	} from './notes-avatar-tabs-state';
	import { buildNotesOverviewHref, readNotesRouteScope } from './notes-workbench-location';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();

	const controller = getAppControllerContext();
	let notesAvatarTabs = $state(readNotesAvatarTabs());

	const routeScope = $derived(readNotesRouteScope(page.url.pathname));
	const activeAvatarNickname = $derived(routeScope.avatarNickname);
	const avatars = $derived(controller.runtimeState.globalAvatarCatalog.data);
	const activeTabValue = $derived(activeAvatarNickname ? `notes-avatar:${activeAvatarNickname}` : 'overview');

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const syncNotesAvatarTabs = (): void => {
			notesAvatarTabs = readNotesAvatarTabs();
		};
		window.addEventListener(NOTES_AVATAR_TABS_CHANGE_EVENT, syncNotesAvatarTabs);
		window.addEventListener('storage', syncNotesAvatarTabs);
		return () => {
			window.removeEventListener(NOTES_AVATAR_TABS_CHANGE_EVENT, syncNotesAvatarTabs);
			window.removeEventListener('storage', syncNotesAvatarTabs);
		};
	});

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalAvatarCatalog();
		void controller.runtimeStore.hydrateGlobalAvatarCatalog();
		return () => {
			release();
		};
	});

	$effect(() => {
		if (!activeAvatarNickname) {
			return;
		}
		notesAvatarTabs = upsertNotesAvatarTab(notesAvatarTabs, {
			avatarNickname: activeAvatarNickname,
		}).entries;
	});

	const copyToClipboard = async (value: string): Promise<void> => {
		if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
			return;
		}
		await navigator.clipboard.writeText(value);
	};

	const closeNotesAvatarTab = async (tabId: string): Promise<void> => {
		const nextTab = resolveAdjacentWorkbenchTab(notesAvatarTabs, (tab) => tab.id, tabId);
		notesAvatarTabs = removeNotesAvatarTab(notesAvatarTabs, tabId);
		if (`notes-avatar:${activeAvatarNickname ?? ''}` !== tabId) {
			return;
		}
		await goto(nextTab?.href ?? buildNotesOverviewHref(), {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const tabs = $derived.by(() => {
		const fixedTabs = [
			{
				id: 'overview',
				href: buildNotesOverviewHref(),
				label: 'Overview',
				icon: NotebookTextIcon,
				title: 'Notes overview',
				description: 'Open one avatar-scoped NoteSystem tab.',
			},
		] satisfies WorkbenchTabItem[];

		// Avatar tab identity is local workbench presence; workspace/source roots stay inside the avatar surface.
		const avatarTabs = notesAvatarTabs.map((tab) => {
			const avatar = avatars.find((entry) => entry.nickname === tab.avatarNickname) ?? null;
			const label = avatar?.displayName ?? tab.avatarNickname;
			return {
				id: tab.id,
				href: tab.href,
				label,
				avatarLabel: label,
				avatarUrl: avatar?.iconUrl ?? null,
				title: `${label} notes`,
				description: 'Avatar-scoped NoteSystem browser.',
				closable: true,
				onClose: () => void closeNotesAvatarTab(tab.id),
				menuItems: [
					{
						id: `copy:${tab.id}`,
						label: 'Copy avatar nickname',
						onSelect: () => void copyToClipboard(tab.avatarNickname),
					},
					{
						id: `close:${tab.id}`,
						label: 'Close tab',
						danger: true,
						onSelect: () => void closeNotesAvatarTab(tab.id),
					},
				],
			};
		}) satisfies WorkbenchTabItem[];

		return [...fixedTabs, ...avatarTabs];
	});

	const handleWorkbenchValueChange = async (value: string): Promise<void> => {
		const nextTab = tabs.find((tab) => tab.id === value);
		if (!nextTab?.href) {
			return;
		}
		await goto(nextTab.href, {
			noScroll: true,
			keepFocus: true,
		});
	};
</script>

<div class="h-full" data-testid="notes-workbench">
	<WorkbenchWindow
		ariaLabel="Notes workbench tabs"
		value={activeTabValue}
		{tabs}
		onValueChange={handleWorkbenchValueChange}
		bodyMode="fill"
	>
		<div class="min-h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
