<script lang="ts">
	import MailIcon from '@lucide/svelte/icons/mail';
	import FolderKanbanIcon from '@lucide/svelte/icons/folder-kanban';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';
	import BotIcon from '@lucide/svelte/icons/bot';

	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte';
	import {
		AVATAR_SESSION_TABS_CHANGE_EVENT,
		readAvatarSessionTabIds,
		upsertAvatarSessionTabId,
	} from '$lib/features/avatars/avatar-session-tabs-state';
	import RunningAvatarRail from '$lib/features/shell/running-avatar-rail.svelte';
	import { RunningAvatarPinSource } from '$lib/features/shell/running-avatar-pin-source';
	import {
		reconcilePinnedRunningAvatarIds,
		togglePinnedRunningAvatarId,
	} from '$lib/features/shell/running-avatar-rail-state';
	import {
		buildAvatarSessionRailItems,
		extractRuntimeSessionId,
	} from '$lib/features/runtime/runtime-shell-state';
	import { cn } from '$lib/utils.js';
	import type { AppController } from '$lib/app/types';

	let {
		controller,
		children,
	}: {
		controller: AppController;
		children?: Snippet;
	} = $props();

	const navItems = [
		{ href: '/avatars', label: 'Avatars', icon: BotIcon },
		{ href: '/workspaces', label: 'Workspaces', icon: FolderKanbanIcon },
		{ href: '/messages', label: 'Messages', icon: MailIcon },
		{ href: '/terminals', label: 'Terminals', icon: SquareTerminalIcon },
	] as const;
	const compactViewport = new IsMobile();
	const runningAvatarPinSource = new RunningAvatarPinSource();

	const activeItem = $derived(
		navItems.find((item) => page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`)) ??
			null,
	);
	let openedAvatarSessionIds = $state<string[]>(readAvatarSessionTabIds());
	let pinnedAvatarSessionIds = $state<string[]>([]);
	const activeAvatarSessionId = $derived(extractRuntimeSessionId(page.url.pathname));
	const avatarSubmenuItems = $derived(
		buildAvatarSessionRailItems(controller.runtimeState, {
			activeSessionId: activeAvatarSessionId,
			openedSessionIds: openedAvatarSessionIds,
			pinnedSessionIds: pinnedAvatarSessionIds,
			resolveSessionIconUrl: (sessionId) => controller.runtimeStore.sessionIconUrl(sessionId),
		}),
	);
	const showAvatarSubmenu = $derived(avatarSubmenuItems.length > 0 || activeItem?.href === '/avatars');
	const adminActive = $derived(page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/'));
	const activeTitle = $derived(adminActive ? 'Admin' : activeItem?.label ?? 'Agenter');
	let shellSidebarOpen = $state(true);
	let desktopSidebarOpen = $state(true);
	let previousCompactViewport = $state<boolean | null>(null);

	const profileLabel = $derived('Super admin');
	const profileDetailLabel = $derived(
		controller.authSession?.profile.metadata.displayName ??
			controller.authSession?.profile.metadata.nickname ??
			controller.authSession?.claims.authId ??
			'No root key bound',
	);

	const profileIconUrl = $derived(
		controller.authSession?.profile.profileId
			? controller.runtimeStore.profileIconUrl(controller.authSession.profile.profileId)
			: null,
	);
	const profileSecondaryLabel = $derived(
		'Open /admin',
	);

	$effect(() => {
		if (!controller.authSession) {
			pinnedAvatarSessionIds = [];
			return;
		}
		let active = true;
		const applySnapshot = (snapshot: { ids: string[] }): void => {
			if (!active) {
				return;
			}
			pinnedAvatarSessionIds = snapshot.ids;
		};
		void runningAvatarPinSource.hydrate(controller.runtimeStore).then(applySnapshot);
		const unsubscribe = runningAvatarPinSource.subscribe(controller.runtimeStore, applySnapshot);
		return () => {
			active = false;
			unsubscribe();
		};
	});

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const syncAvatarSessionTabs = (): void => {
			openedAvatarSessionIds = readAvatarSessionTabIds();
		};
		window.addEventListener(AVATAR_SESSION_TABS_CHANGE_EVENT, syncAvatarSessionTabs);
		window.addEventListener('storage', syncAvatarSessionTabs);
		return () => {
			window.removeEventListener(AVATAR_SESSION_TABS_CHANGE_EVENT, syncAvatarSessionTabs);
			window.removeEventListener('storage', syncAvatarSessionTabs);
		};
	});

	$effect(() => {
		if (!activeAvatarSessionId) {
			return;
		}
		openedAvatarSessionIds = upsertAvatarSessionTabId(openedAvatarSessionIds, activeAvatarSessionId);
	});

	$effect(() => {
		const reconciledPinnedIds = reconcilePinnedRunningAvatarIds(
			pinnedAvatarSessionIds,
			controller.runtimeState.sessions.map((session) => session.id),
		);
		if (reconciledPinnedIds !== pinnedAvatarSessionIds) {
			pinnedAvatarSessionIds = reconciledPinnedIds;
			if (controller.authSession) {
				void runningAvatarPinSource.reconcile(
					controller.runtimeStore,
					controller.runtimeState.sessions.map((session) => session.id),
				).then((snapshot) => {
					pinnedAvatarSessionIds = snapshot.ids;
				});
			}
		}
	});

	$effect(() => {
		const nextCompactViewport = compactViewport.current;
		if (previousCompactViewport === null) {
			shellSidebarOpen = nextCompactViewport ? false : desktopSidebarOpen;
			previousCompactViewport = nextCompactViewport;
			return;
		}
		if (nextCompactViewport === previousCompactViewport) {
			return;
		}
		previousCompactViewport = nextCompactViewport;
		shellSidebarOpen = nextCompactViewport ? false : desktopSidebarOpen;
	});

	const handleShellSidebarOpenChange = (nextOpen: boolean): void => {
		shellSidebarOpen = nextOpen;
		if (!compactViewport.current) {
			desktopSidebarOpen = nextOpen;
		}
	};
</script>

<svelte:head>
	<title>{activeTitle} · Agenter</title>
</svelte:head>

<Sidebar.Provider open={shellSidebarOpen} onOpenChange={handleShellSidebarOpenChange}>
	<Sidebar.Sidebar mobileMode="docked" collapsible="icon" variant="inset">
		<Sidebar.Header class="border-b border-sidebar-border px-2 py-3">
			<div class="flex items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
				<div
					class="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:hidden"
				>
					<MailIcon class="size-5" />
				</div>
				<div class="grid min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
					<div class="truncate text-sm font-semibold">Agenter</div>
					<div class="truncate text-xs text-sidebar-foreground/70">Orthogonal systems cockpit</div>
				</div>
				<Sidebar.Trigger
					class="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent/70"
					title="Toggle application navigation"
					aria-label="Toggle application navigation"
				/>
			</div>
		</Sidebar.Header>

		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupLabel>Systems</Sidebar.GroupLabel>
				<Sidebar.Menu>
					{#each navItems as item (item.href)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={activeItem?.href === item.href} tooltipContent={item.label}>
								{#snippet child({ props })}
									<a href={item.href} {...props}>
										<item.icon class="size-4" />
										<span class="group-data-[collapsible=icon]:hidden">{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
							{#if item.href === '/avatars' && showAvatarSubmenu}
								<RunningAvatarRail
									items={avatarSubmenuItems}
									onTogglePin={(sessionId, nextPinned) => {
										pinnedAvatarSessionIds = togglePinnedRunningAvatarId(
											pinnedAvatarSessionIds,
											sessionId,
											nextPinned,
										);
										if (controller.authSession) {
											void runningAvatarPinSource
												.toggle(controller.runtimeStore, sessionId, nextPinned)
												.then((snapshot) => {
													pinnedAvatarSessionIds = snapshot.ids;
												});
										}
									}}
								/>
							{/if}
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer class="border-t border-sidebar-border px-2 py-3">
			<a
				href="/admin"
				aria-label={profileLabel}
				title={profileLabel}
				class={cn(
					'flex items-center gap-3 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 px-3 py-3 transition-colors hover:bg-sidebar-accent/70',
					'group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:self-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:border-sidebar-border/60 group-data-[collapsible=icon]:bg-sidebar-accent/20 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0',
					adminActive && 'bg-sidebar-accent ring-1 ring-sidebar-ring',
				)}
			>
				<ProfileAvatar label={profileLabel} src={profileIconUrl} class="size-10 group-data-[collapsible=icon]:size-7" />
				<div class="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
					<div class="truncate text-sm font-medium">{profileLabel}</div>
					<div class="truncate text-xs text-sidebar-foreground/70">
						{profileDetailLabel} · {profileSecondaryLabel}
					</div>
				</div>
			</a>
		</Sidebar.Footer>
		<Sidebar.Rail />
	</Sidebar.Sidebar>

	<Sidebar.Inset
		class="h-svh bg-background md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none"
	>
		<div class="flex h-full flex-1 flex-col">
			{@render children?.()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
