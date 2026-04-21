<script lang="ts">
	import BotIcon from '@lucide/svelte/icons/bot';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import { getAppControllerContext } from '$lib/app/controller-context';
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
		upsertAvatarCreateTab,
		type AvatarCreateTabEntry,
	} from './avatar-create-tabs-state';
	import { createAvatarCreateDraft } from './avatar-create-draft-resource';
	import { buildAvatarCatalogHref, buildAvatarNewHref } from './avatar-workbench-location';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();

	const controller = getAppControllerContext();
	let avatarSessionTabIds = $state<string[]>(readAvatarSessionTabIds());
	let avatarCreateTabs = $state<AvatarCreateTabEntry[]>(readAvatarCreateTabs());
	let dismissedSessionIds = $state<string[]>(readDismissedWorkbenchTabIds('avatars-runtime'));
	let createTabBusy = $state(false);

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

	const activeCreateTab = $derived.by((): AvatarCreateTabEntry | null => {
		if (!activeDraftId) {
			return null;
		}
		return (
			avatarCreateTabs.find((tab) => tab.draftId === activeDraftId) ?? {
				draftId: activeDraftId,
				href: activeDraftHref ?? buildAvatarNewHref({ draftId: activeDraftId }),
				draftNickname: '',
				sourceAvatarNickname: '',
			}
		);
	});
	const createTabEntry = $derived(activeCreateTab ?? avatarCreateTabs.at(-1) ?? null);

	const openCreateTab = async (): Promise<void> => {
		const existingHref = createTabEntry?.href;
		if (existingHref) {
			await goto(existingHref, {
				keepFocus: true,
				noScroll: true,
			});
			return;
		}
		if (createTabBusy) {
			return;
		}
		createTabBusy = true;
		try {
			const created = await createAvatarCreateDraft(controller.runtimeStore);
			await goto(buildAvatarNewHref({ draftId: created.resource.draftId }), {
				keepFocus: true,
				noScroll: true,
			});
		} catch {
			// Ignore create-tab bootstrap failures here; the route surfaces durable draft errors after navigation succeeds.
		} finally {
			createTabBusy = false;
		}
	};

	const tabs = $derived.by(() => {
		const fixedTabs = [
			{
				id: 'catalog',
				href: buildAvatarCatalogHref(),
				label: 'My avatars',
				icon: BotIcon,
				title: 'My avatars',
				description: 'Operate installed avatars, open runtime shells, and manage addable avatar drafts.',
			},
			{
				id: 'create',
				href: createTabEntry?.href,
				label: 'Add avatar',
				icon: PlusIcon,
				title: 'Add avatar',
				description: createTabEntry
					? createTabEntry.sourceAvatarNickname
						? `Resume draft from ${createTabEntry.sourceAvatarNickname}`
						: createTabEntry.draftNickname.length > 0
							? `Resume draft: ${createTabEntry.draftNickname}`
							: `Resume avatar draft · ${createTabEntry.draftId}`
					: 'Create a new avatar draft.',
				loading: createTabBusy,
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

		return [...fixedTabs, ...runtimeTabs];
	});

	const activeTabValue = $derived(activeDraftId ? 'create' : activeSessionId ?? 'catalog');

	const handleWorkbenchValueChange = async (value: string): Promise<void> => {
		if (value === 'create') {
			await openCreateTab();
			return;
		}
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

<div class="h-full" data-testid="avatars-workbench">
	<WorkbenchWindow
		ariaLabel="Avatar workbench tabs"
		value={activeTabValue}
		{tabs}
		onValueChange={handleWorkbenchValueChange}
		bodyMode="fill"
	>
		<div class="h-full min-h-0">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
