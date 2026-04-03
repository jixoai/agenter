<script lang="ts">
	import FolderKanbanIcon from '@lucide/svelte/icons/folder-kanban';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import MailIcon from '@lucide/svelte/icons/mail';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';

	import { page } from '$app/state';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import RunningAvatarRail from '$lib/features/shell/running-avatar-rail.svelte';
	import {
		buildRunningAvatarRailItems,
		extractRuntimeSessionId,
		extractRuntimeTab,
		RUNTIME_TAB_LABELS,
	} from '$lib/features/runtime/runtime-shell-state';
	import { cn } from '$lib/utils.js';
	import type { AppController } from '$lib/app/types';

	let {
		controller,
		children,
	}: {
		controller: AppController;
		children?: import('svelte').Snippet;
	} = $props();

	const navItems = [
		{ href: '/workspaces', label: 'Workspaces', icon: FolderKanbanIcon },
		{ href: '/history', label: 'History', icon: HistoryIcon },
		{ href: '/messages', label: 'Messages', icon: MailIcon },
		{ href: '/terminals', label: 'Terminals', icon: SquareTerminalIcon },
		{ href: '/settings', label: 'Settings', icon: Settings2Icon },
	] as const;

	const activeItem = $derived(
		navItems.find((item) => page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`)) ??
			null,
	);
	const activeRuntimeSessionId = $derived(extractRuntimeSessionId(page.url.pathname));
	const activeRuntimeTab = $derived(extractRuntimeTab(page.url.pathname));
	const runningAvatarItems = $derived(
		buildRunningAvatarRailItems(controller.runtimeState, {
			activeSessionId: activeRuntimeSessionId,
			resolveSessionIconUrl: (sessionId) => controller.runtimeStore.sessionIconUrl(sessionId),
		}),
	);
	const activeTitle = $derived(
		activeRuntimeTab ? RUNTIME_TAB_LABELS[activeRuntimeTab] : (activeItem?.label ?? 'Agenter'),
	);

	const profileLabel = $derived(
		controller.authSession?.profile.metadata.displayName ??
			controller.authSession?.profile.metadata.nickname ??
			controller.authSession?.claims.authId ??
			'Superadmin',
	);

	const profileIconUrl = $derived(
		controller.authSession?.profile.profileId
			? controller.runtimeStore.profileIconUrl(controller.authSession.profile.profileId)
			: null,
	);
</script>

<svelte:head>
	<title>{activeTitle} · Agenter</title>
</svelte:head>

<Sidebar.Provider>
	<Sidebar.Sidebar collapsible="icon" variant="inset">
		<Sidebar.Header class="border-b border-sidebar-border px-2 py-3">
			<div class="flex items-center gap-3 px-2">
				<div class="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
					<MailIcon class="size-5" />
				</div>
				<div class="grid min-w-0 flex-1">
					<div class="truncate text-sm font-semibold">Agenter</div>
					<div class="truncate text-xs text-sidebar-foreground/70">Orthogonal systems cockpit</div>
				</div>
			</div>
		</Sidebar.Header>

		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupLabel>Systems</Sidebar.GroupLabel>
				<Sidebar.Menu>
					{#each navItems as item}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={activeItem?.href === item.href} tooltipContent={item.label}>
								{#snippet child({ props })}
									<a href={item.href} {...props}>
									<item.icon class="size-4" />
									<span>{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.Group>

			<RunningAvatarRail items={runningAvatarItems} />
		</Sidebar.Content>

		<Sidebar.Footer class="border-t border-sidebar-border px-2 py-3">
			<a
				href="/settings"
				class="flex items-center gap-3 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 px-3 py-3 transition-colors hover:bg-sidebar-accent"
			>
				<ProfileAvatar label={profileLabel} src={profileIconUrl} class="size-10" />
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-medium">{profileLabel}</div>
						<div class="truncate text-xs text-sidebar-foreground/70">
							{controller.authSession ? 'Superadmin settings' : 'Bind root key'}
						</div>
					</div>
				</a>
			</Sidebar.Footer>
	</Sidebar.Sidebar>

	<Sidebar.Inset class="min-h-svh bg-background">
		<div class="flex h-svh min-h-0 flex-col">
			<header class="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
				<div class="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
					<div class="flex min-w-0 items-center gap-3">
						<Sidebar.Trigger class="md:hidden" aria-label="Toggle Sidebar" title="Toggle Sidebar" />
						<div class="grid min-w-0">
							<div class="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">Agenter</div>
							<div class="truncate text-lg font-semibold">{activeTitle}</div>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<div class="hidden max-w-md truncate rounded-full border px-3 py-1 text-xs text-muted-foreground md:block">
							{controller.statusText}
						</div>
						<Button
							size="icon-sm"
							variant="outline"
							onclick={() => void controller.refreshBootstrap()}
							disabled={controller.refreshing}
							aria-label="Refresh runtime state"
							title="Refresh runtime state"
						>
							<RefreshCwIcon class={cn('size-4', controller.refreshing && 'animate-spin')} />
						</Button>
					</div>
				</div>
			</header>

			<main class="min-h-0 flex-1">{@render children?.()}</main>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
