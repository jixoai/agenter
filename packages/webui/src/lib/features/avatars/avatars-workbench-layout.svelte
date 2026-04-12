<script lang="ts">
	import BotIcon from '@lucide/svelte/icons/bot';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import {
		AVATAR_SESSION_TABS_CHANGE_EVENT,
		readAvatarSessionTabIds,
		removeAvatarSessionTabId,
		upsertAvatarSessionTabId,
	} from '$lib/features/avatars/avatar-session-tabs-state';
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
	import {
		AVATAR_CREATE_TABS_CHANGE_EVENT,
		readAvatarCreateTabs,
		removeAvatarCreateTab,
		upsertAvatarCreateTab,
		type AvatarCreateTabEntry,
	} from './avatar-create-tabs-state';
	import { buildAvatarCatalogHref, buildAvatarNewHref, createAvatarDraftId } from './avatar-workbench-location';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();

	const controller = getAppControllerContext();
	let avatarSessionTabIds = $state<string[]>(readAvatarSessionTabIds());
	let avatarCreateTabs = $state<AvatarCreateTabEntry[]>(readAvatarCreateTabs());
	let dismissedSessionIds = $state<string[]>(readDismissedWorkbenchTabIds('avatars-runtime'));
	let nextToolbarDraftId = $state(createAvatarDraftId());
	let lastToolbarRoute = $state('');

	const activeSessionId = $derived(extractRuntimeSessionId(page.url.pathname));
	const activeDraftId = $derived.by(() => {
		const match = /^\/avatars\/new\/([^/]+)$/u.exec(page.url.pathname);
		return match ? decodeURIComponent(match[1] ?? '') : null;
	});
	const activeDraftHref = $derived.by(() => (activeDraftId ? `${page.url.pathname}${page.url.search}` : null));
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
		if (typeof window === 'undefined') {
			return;
		}
		const syncAvatarCreateTabs = (): void => {
			avatarCreateTabs = readAvatarCreateTabs();
		};
		window.addEventListener(AVATAR_CREATE_TABS_CHANGE_EVENT, syncAvatarCreateTabs);
		window.addEventListener('storage', syncAvatarCreateTabs);
		return () => {
			window.removeEventListener(AVATAR_CREATE_TABS_CHANGE_EVENT, syncAvatarCreateTabs);
			window.removeEventListener('storage', syncAvatarCreateTabs);
		};
	});

	$effect(() => {
		if (!activeSessionId) {
			return;
		}
		avatarSessionTabIds = upsertAvatarSessionTabId(avatarSessionTabIds, activeSessionId);
		dismissedSessionIds = restoreWorkbenchTabId('avatars-runtime', dismissedSessionIds, activeSessionId);
	});

	$effect(() => {
		if (!activeDraftId || !activeDraftHref) {
			return;
		}
		const existing = avatarCreateTabs.find((tab) => tab.draftId === activeDraftId) ?? null;
		avatarCreateTabs = upsertAvatarCreateTab(avatarCreateTabs, {
			draftId: activeDraftId,
			href: activeDraftHref,
			draftNickname: existing?.draftNickname ?? '',
			sourceAvatarNickname: existing?.sourceAvatarNickname ?? '',
		});
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
		await goto(nextSession?.href ?? '/avatars/catalog', {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const closeCreateTab = async (draftId: string): Promise<void> => {
		const dynamicTabs = [
			...avatarCreateTabs.map((tab) => ({
				id: `new:${tab.draftId}`,
				href: tab.href,
			})),
			...runtimeItems.map((item) => ({
				id: item.sessionId,
				href: item.href,
			})),
		];
		const nextTab = resolveAdjacentWorkbenchTab(dynamicTabs, (tab) => tab.id, `new:${draftId}`);
		if (activeDraftId !== draftId) {
			avatarCreateTabs = removeAvatarCreateTab(avatarCreateTabs, draftId);
			return;
		}
		await goto(nextTab?.href ?? buildAvatarCatalogHref(), {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
		avatarCreateTabs = removeAvatarCreateTab(avatarCreateTabs, draftId);
	};

	$effect(() => {
		const currentRoute = `${page.url.pathname}${page.url.search}`;
		if (currentRoute === lastToolbarRoute) {
			return;
		}
		lastToolbarRoute = currentRoute;
		nextToolbarDraftId = createAvatarDraftId();
	});

	const tabs = $derived.by(() => {
		const fixedTabs = [
			{
				id: 'catalog',
				href: buildAvatarCatalogHref(),
				label: 'Catalog',
				icon: BotIcon,
				title: 'Avatar catalog',
				description: 'Inspect global avatar identities, open runtime shells, and manage addable avatar drafts.',
			},
		] satisfies WorkbenchTabItem[];

		const createTabs = avatarCreateTabs.map((entry) => ({
			id: `new:${entry.draftId}`,
			href: entry.href,
			label: entry.draftNickname.length > 0 ? entry.draftNickname : 'New avatar',
			icon: PlusIcon,
			title: entry.draftNickname.length > 0 ? `New avatar · ${entry.draftNickname}` : `New avatar draft · ${entry.draftId}`,
			description: entry.sourceAvatarNickname ? `Template source: ${entry.sourceAvatarNickname}` : 'Avatar creation draft',
			closable: true,
			onClose: () => void closeCreateTab(entry.draftId),
			menuItems: [
				{
					id: `copy:${entry.draftId}`,
					label: 'Copy draft id',
					onSelect: () => void copyToClipboard(entry.draftId),
				},
				{
					id: `close:${entry.draftId}`,
					label: 'Close tab',
					danger: true,
					onSelect: () => void closeCreateTab(entry.draftId),
				},
			],
		})) satisfies WorkbenchTabItem[];

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
					label: 'Copy runtime id',
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

		return [...fixedTabs, ...createTabs, ...runtimeTabs];
	});

	const activeTabValue = $derived(activeDraftId ? `new:${activeDraftId}` : activeSessionId ?? 'catalog');
	const nextToolbarDraftHref = $derived(buildAvatarNewHref({ draftId: nextToolbarDraftId }));
</script>

{#snippet avatarsToolbarMeta(_toolbarState: WorkbenchToolbarRenderState)}
	<Badge variant="outline" class="bg-background/70">{controller.runtimeState.globalAvatarCatalog.data.length} avatars</Badge>
	<Badge variant="outline" class="bg-background/70">{avatarCreateTabs.length} draft tabs</Badge>
	<Badge variant="outline" class="bg-background/70">{runtimeItems.length} runtime tabs</Badge>
	{#if dismissedSessionIds.length > 0}
		<Badge variant="outline" class="bg-background/70">{dismissedSessionIds.length} hidden tabs</Badge>
	{/if}
{/snippet}

{#snippet avatarsToolbarActions(_toolbarState: WorkbenchToolbarRenderState)}
	<Button size="sm" variant="outline" href={nextToolbarDraftHref}>
		<PlusIcon class="size-4" />
		New avatar
	</Button>
{/snippet}

{#snippet avatarsToolbar()}
	<WorkbenchToolbar meta={avatarsToolbarMeta} actions={avatarsToolbarActions} />
{/snippet}

<div class="h-full" data-testid="avatars-workbench">
	<WorkbenchWindow
		ariaLabel="Avatar workbench tabs"
		value={activeTabValue}
		{tabs}
		toolbar={avatarsToolbar}
	>
		<div class="h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
