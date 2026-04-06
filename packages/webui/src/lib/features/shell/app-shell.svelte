<script lang="ts">
	import MailIcon from '@lucide/svelte/icons/mail';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';
	import BotIcon from '@lucide/svelte/icons/bot';

	import { page } from '$app/state';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
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
		{ href: '/avatars', label: 'Avatars', icon: BotIcon },
		{ href: '/messages', label: 'Messages', icon: MailIcon },
		{ href: '/terminals', label: 'Terminals', icon: SquareTerminalIcon },
	] as const;

	const activeItem = $derived(
		navItems.find((item) => page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`)) ??
			null,
	);
	const adminActive = $derived(page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/'));
	const activeTitle = $derived(adminActive ? 'Admin' : activeItem?.label ?? 'Agenter');

	const profileLabel = $derived(
		controller.authSession?.profile.metadata.displayName ??
			controller.authSession?.profile.metadata.nickname ??
			controller.authSession?.claims.authId ??
			'Unauthenticated',
	);

	const profileIconUrl = $derived(
		controller.authSession?.profile.profileId
			? controller.runtimeStore.profileIconUrl(controller.authSession.profile.profileId)
			: null,
	);
	const profileSecondaryLabel = $derived(
		controller.authSession?.claims.authId
			? controller.authSession.claims.authId === profileLabel
				? 'Authenticated superadmin'
				: controller.authSession.claims.authId
			: 'Bind root key',
	);
</script>

<svelte:head>
	<title>{activeTitle} · Agenter</title>
</svelte:head>

<Sidebar.Provider>
	<Sidebar.Sidebar collapsible="icon" variant="inset">
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
					{#each navItems as item}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={activeItem?.href === item.href} tooltipContent={item.label}>
								{#snippet child({ props })}
									<a href={item.href} {...props}>
										<item.icon class="size-4" />
										<span class="group-data-[collapsible=icon]:hidden">{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
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
						{profileSecondaryLabel}
					</div>
				</div>
			</a>
		</Sidebar.Footer>
		<Sidebar.Rail />
	</Sidebar.Sidebar>

	<Sidebar.Inset class="h-svh bg-background">
		<div class="flex h-full flex-1 flex-col">
			{@render children?.()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
