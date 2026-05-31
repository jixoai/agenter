<script lang="ts">
import SparklesIcon from '@lucide/svelte/icons/sparkles';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { Snippet } from 'svelte';

import { getAppControllerContext } from '$lib/app/controller-context';
import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
import { resolveAdjacentWorkbenchTab } from '$lib/features/navigation/workbench-tab-state';
	import {
		readSkillAvatarTabs,
		removeSkillAvatarTab,
		SKILL_AVATAR_TABS_CHANGE_EVENT,
		upsertSkillAvatarTab,
	} from './skill-avatar-tabs-state';
	import {
		buildSkillsCatalogHref,
		readSkillsAvatarNickname,
		readSkillsCatalogView,
	} from './skills-workbench-location';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();

	const controller = getAppControllerContext();
	let skillAvatarTabs = $state(readSkillAvatarTabs());
	let avatarCatalog = $state<
		Awaited<ReturnType<ReturnType<typeof getAppControllerContext>['runtimeStore']['listSkillAvatarCatalog']>>['items']
	>([]);
	let avatarCatalogLoaded = $state(false);

	const activeAvatarNickname = $derived.by(() => {
		const match = /^\/skills\/avatar\/([^/]+)$/u.exec(page.url.pathname);
		return match ? decodeURIComponent(match[1] ?? '') : null;
	});
	const activeCatalogHref = $derived.by(() =>
		page.url.pathname === '/skills'
			? buildSkillsCatalogHref({
					view: readSkillsCatalogView(page.url.searchParams),
					avatar: readSkillsAvatarNickname(page.url.searchParams),
				})
			: buildSkillsCatalogHref(),
	);

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const syncSkillAvatarTabs = (): void => {
			skillAvatarTabs = readSkillAvatarTabs();
		};
		window.addEventListener(SKILL_AVATAR_TABS_CHANGE_EVENT, syncSkillAvatarTabs);
		window.addEventListener('storage', syncSkillAvatarTabs);
		return () => {
			window.removeEventListener(SKILL_AVATAR_TABS_CHANGE_EVENT, syncSkillAvatarTabs);
			window.removeEventListener('storage', syncSkillAvatarTabs);
		};
	});

	$effect(() => {
		if (avatarCatalogLoaded) {
			return;
		}
		avatarCatalogLoaded = true;
		void controller.runtimeStore
			.listSkillAvatarCatalog()
			.then((output) => {
				avatarCatalog = output.items;
			})
			.catch(() => {
				avatarCatalog = [];
			});
	});

	$effect(() => {
		if (!activeAvatarNickname) {
			return;
		}
		skillAvatarTabs = upsertSkillAvatarTab(skillAvatarTabs, {
			avatarNickname: activeAvatarNickname,
		}).entries;
	});

	const copyToClipboard = async (value: string): Promise<void> => {
		if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
			return;
		}
		await navigator.clipboard.writeText(value);
	};

	const closeSkillAvatarTab = async (tabId: string): Promise<void> => {
		const nextTab = resolveAdjacentWorkbenchTab(skillAvatarTabs, (tab) => tab.id, tabId);
		skillAvatarTabs = removeSkillAvatarTab(skillAvatarTabs, tabId);
		if (`skill-avatar:${activeAvatarNickname ?? ''}` !== tabId) {
			return;
		}
		await goto(nextTab?.href ?? activeCatalogHref, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const tabs = $derived.by(() => {
		const fixedTabs = [
			{
				id: 'catalog',
				href: activeCatalogHref,
				label: 'Catalog',
				icon: SparklesIcon,
				title: 'Skills catalog',
				description: 'Inspect SKILLS_HOME, built-in, and avatar-private skills through one read-only workbench.',
			},
		] satisfies WorkbenchTabItem[];

		const avatarTabs = skillAvatarTabs.map((tab) => {
			const avatar = avatarCatalog.find((entry) => entry.nickname === tab.avatarNickname) ?? null;
			return {
			id: tab.id,
			href: tab.href,
			label: avatar?.displayName ?? tab.avatarNickname,
			avatarLabel: avatar?.displayName ?? tab.avatarNickname,
			avatarUrl: avatar?.iconUrl ?? null,
			title: `${avatar?.displayName ?? tab.avatarNickname} skills`,
			description: 'Workspace-grouped avatar skill browser.',
			closable: true,
			onClose: () => void closeSkillAvatarTab(tab.id),
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
					onSelect: () => void closeSkillAvatarTab(tab.id),
				},
			],
			};
		}) satisfies WorkbenchTabItem[];

		return [...fixedTabs, ...avatarTabs];
	});

	const activeTabValue = $derived(activeAvatarNickname ? `skill-avatar:${activeAvatarNickname}` : 'catalog');

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

<div class="h-full" data-testid="skills-workbench">
	<WorkbenchWindow
		ariaLabel="Skills workbench tabs"
		value={activeTabValue}
		{tabs}
		onValueChange={handleWorkbenchValueChange}
		bodyMode="fill"
	>
		<div class="min-h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
