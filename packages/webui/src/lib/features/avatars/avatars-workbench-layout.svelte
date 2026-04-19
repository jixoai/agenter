<script lang="ts">
	import BotIcon from '@lucide/svelte/icons/bot';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
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
	let toolbarDraftBusy = $state(false);

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

	const openToolbarDraft = async (): Promise<void> => {
		if (toolbarDraftBusy) {
			return;
		}
		toolbarDraftBusy = true;
		try {
			const created = await createAvatarCreateDraft(controller.runtimeStore);
			await goto(buildAvatarNewHref({ draftId: created.resource.draftId }), {
				keepFocus: true,
				noScroll: true,
			});
		} catch {
			// Ignore toolbar draft failures here; route-level draft UI surfaces the durable error states.
		} finally {
			toolbarDraftBusy = false;
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
	const activeTabItem = $derived.by((): WorkbenchTabItem | null => tabs.find((tab) => tab.id === activeTabValue) ?? tabs[0] ?? null);
	const activeToolbarAvatarLabel = $derived(
		activeTabItem && 'avatarLabel' in activeTabItem ? activeTabItem.avatarLabel : null,
	);
	const activeToolbarAvatarUrl = $derived(
		activeTabItem && 'avatarUrl' in activeTabItem ? activeTabItem.avatarUrl : null,
	);
	const activeToolbarIcon = $derived(
		activeTabItem && 'icon' in activeTabItem ? activeTabItem.icon : null,
	);
	const activeToolbarSubtitle = $derived.by(() => {
		if (!activeTabItem || activeTabItem.id === 'catalog') {
			return null;
		}
		return activeTabItem.title ?? activeTabItem.description ?? null;
	});
	const ActiveToolbarIcon = $derived(activeToolbarIcon ?? BotIcon);
</script>

{#snippet avatarsToolbarContent(toolbarState: WorkbenchToolbarRenderState)}
	<div class="avatar-page-toolbar" data-testid="avatar-workbench-toolbar" data-toolbar-breakpoint={toolbarState.breakpoint}>
		<div class="avatar-page-toolbar__identity" title={activeTabItem?.title ?? activeTabItem?.label ?? 'My avatars'}>
			{#if activeToolbarAvatarLabel}
				<ProfileAvatar
					label={activeToolbarAvatarLabel}
					src={activeToolbarAvatarUrl}
					class="avatar-page-toolbar__avatar"
				/>
			{:else}
				<div class="avatar-page-toolbar__icon">
					<ActiveToolbarIcon class="size-4" />
				</div>
			{/if}
			<div class="avatar-page-toolbar__title">
				<span class="truncate font-semibold">{activeTabItem?.label ?? 'My avatars'}</span>
				{#if !toolbarState.isNarrow && activeToolbarSubtitle}
					<span class="truncate text-xs text-muted-foreground">
						{activeToolbarSubtitle}
					</span>
				{/if}
			</div>
		</div>

		<div class="avatar-page-toolbar__actions">
			<Button
				size={toolbarState.isNarrow ? 'icon-sm' : 'sm'}
				variant="outline"
				disabled={toolbarDraftBusy}
				onclick={() => void openToolbarDraft()}
			>
				<PlusIcon class="size-4" />
				{#if !toolbarState.isNarrow}
					<span>{toolbarDraftBusy ? 'Creating…' : 'New avatar'}</span>
				{/if}
			</Button>
		</div>
	</div>
{/snippet}

{#snippet avatarsToolbar()}
	<WorkbenchToolbar content={avatarsToolbarContent} />
{/snippet}

<div class="h-full" data-testid="avatars-workbench">
	<WorkbenchWindow
		ariaLabel="Avatar workbench tabs"
		value={activeTabValue}
		{tabs}
		toolbar={avatarsToolbar}
	>
		<div class="min-h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>

<style>
	.avatar-page-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		padding-inline: 0.55rem;
	}

	.avatar-page-toolbar__identity,
	.avatar-page-toolbar__actions {
		min-inline-size: 0;
	}

	.avatar-page-toolbar__identity {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-inline-size: 0;
		flex: 1 1 auto;
	}

	.avatar-page-toolbar__icon {
		display: inline-flex;
		block-size: 1.6rem;
		inline-size: 1.6rem;
		flex: none;
		align-items: center;
		justify-content: center;
		border-radius: 0.8rem;
		border: 1px solid color-mix(in srgb, var(--border), transparent 20%);
		background: color-mix(in srgb, var(--background), transparent 12%);
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--background), white 78%);
	}

	:global(.avatar-page-toolbar__avatar) {
		block-size: 1.6rem;
		inline-size: 1.6rem;
		border-radius: 0.8rem;
		border-color: color-mix(in srgb, var(--border), transparent 20%);
		background: color-mix(in srgb, var(--background), transparent 12%);
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--background), white 78%);
	}

	.avatar-page-toolbar__title {
		display: grid;
		min-inline-size: 0;
		gap: 0.12rem;
		font-size: 0.8rem;
		line-height: 1.05;
	}

	.avatar-page-toolbar__actions {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: flex-end;
	}

	@container workbench-page-toolbar (max-width: 44rem) {
		.avatar-page-toolbar {
			gap: 0.45rem;
			padding-inline: 0.45rem;
		}

		.avatar-page-toolbar__identity {
			max-inline-size: 12rem;
		}

		.avatar-page-toolbar__icon,
		:global(.avatar-page-toolbar__avatar) {
			block-size: 1.45rem;
			inline-size: 1.45rem;
		}

		.avatar-page-toolbar__title {
			font-size: 0.76rem;
		}
	}
</style>
