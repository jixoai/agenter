<script lang="ts">
	import PlayIcon from '@lucide/svelte/icons/play';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import type { CachedResourceState, WorkspaceAvatarCatalogEntry } from '@agenter/client-sdk';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import { describeCompactWorkspace } from '$lib/features/workspaces/workspace-sorting';

	const controller = getAppControllerContext();
	const emptyAvatarCatalogState: CachedResourceState<WorkspaceAvatarCatalogEntry[]> = {
		data: [],
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};

	let createBusy = $state(false);

	const workspacePath = $derived(page.url.searchParams.get('path') ?? '');
	const avatarNickname = $derived(page.url.searchParams.get('avatar') ?? '');
	const workspaceName = $derived(
		workspacePath.length > 0 ? describeCompactWorkspace(workspacePath) : 'Unknown workspace',
	);
	const avatarCatalogState = $derived(
		workspacePath.length > 0
			? (controller.runtimeState.workspaceAvatarCatalogByPath[workspacePath] ?? emptyAvatarCatalogState)
			: emptyAvatarCatalogState,
	);
	const avatarEntry = $derived(
		avatarCatalogState.data.find((avatar) => avatar.nickname === avatarNickname) ?? null,
	);

	$effect(() => {
		if (workspacePath.length === 0) {
			return;
		}
		const release = controller.runtimeStore.retainWorkspaceAvatarCatalog(workspacePath);
		void controller.runtimeStore.hydrateWorkspaceAvatarCatalog(workspacePath);
		return () => {
			release();
		};
	});

	const startAvatarSession = async (): Promise<void> => {
		if (workspacePath.length === 0 || avatarNickname.length === 0) {
			return;
		}
		createBusy = true;
		try {
			const session = await controller.runtimeStore.createSession({
				cwd: workspacePath,
				avatar: avatarNickname,
				autoStart: true,
			});
			await goto(`/avatars/runtime/${encodeURIComponent(session.id)}/attention`);
		} finally {
			createBusy = false;
		}
	};
</script>

<WorkbenchScaffold tone="pane" body="scroll" contentClass="grid gap-4 p-4" data-testid="avatar-open-route">
	{#snippet header()}
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="grid gap-2">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-base font-semibold">{avatarNickname || 'Open avatar'}</h1>
					{#if avatarEntry?.defaultAvatar}
						<Badge variant="outline" class="rounded-full text-[11px]">Default</Badge>
					{/if}
					{#if avatarEntry}
						<Badge variant="secondary" class="rounded-full text-[11px]">
							{avatarEntry.sourceScope === 'workspace' ? 'Workspace-local copy' : 'Global source'}
						</Badge>
					{/if}
				</div>
				<div class="text-sm text-muted-foreground">{workspacePath || 'No workspace selected'}</div>
			</div>
			<Button onclick={() => void startAvatarSession()} disabled={!avatarEntry || createBusy}>
				<PlayIcon class="size-4" />
				{createBusy ? 'Starting…' : 'Start avatar'}
			</Button>
		</div>
	{/snippet}

	{#if workspacePath.length === 0 || avatarNickname.length === 0}
		<Item.Root size="sm" variant="muted" class="grid gap-2 py-8 text-sm text-muted-foreground">
			<div>Open avatar requires both a workspace path and an avatar nickname.</div>
			<div>Go back to Workspace and pick an avatar from Quick Start.</div>
		</Item.Root>
	{:else if avatarCatalogState.error}
		<Item.Root size="sm" variant="muted" class="py-8 text-sm text-destructive">
			{avatarCatalogState.error}
		</Item.Root>
	{:else if !avatarEntry}
		<Item.Root size="sm" variant="muted" class="grid gap-2 py-8 text-sm text-muted-foreground">
			<div>Avatar `{avatarNickname}` is not available in this workspace catalog.</div>
			<div>Open the workspace catalog again to refresh the available avatar list.</div>
		</Item.Root>
	{:else}
		<div class="grid gap-3 lg:grid-cols-2">
			<Item.Root size="sm" class="grid gap-3">
				<div class="text-sm font-semibold">Avatar facts</div>
				<dl class="grid gap-3 text-sm text-muted-foreground">
					<div class="grid gap-1">
						<dt class="text-[11px] uppercase tracking-[0.16em]">Nickname</dt>
						<dd class="font-medium text-foreground">{avatarEntry.nickname}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-[11px] uppercase tracking-[0.16em]">Workspace</dt>
						<dd class="font-medium text-foreground">{workspaceName}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-[11px] uppercase tracking-[0.16em]">Effective path</dt>
						<dd class="break-all font-medium text-foreground">{avatarEntry.effectivePath}</dd>
					</div>
				</dl>
			</Item.Root>

			<Item.Root size="sm" class="grid gap-3">
				<div class="text-sm font-semibold">Catalog paths</div>
				<dl class="grid gap-3 text-sm text-muted-foreground">
					<div class="grid gap-1">
						<dt class="text-[11px] uppercase tracking-[0.16em]">Workspace path</dt>
						<dd class="break-all font-medium text-foreground">{avatarEntry.workspacePath}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-[11px] uppercase tracking-[0.16em]">Global path</dt>
						<dd class="break-all font-medium text-foreground">{avatarEntry.globalPath}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-[11px] uppercase tracking-[0.16em]">Source scope</dt>
						<dd class="font-medium text-foreground">{avatarEntry.sourceScope}</dd>
					</div>
				</dl>
			</Item.Root>
		</div>
	{/if}
</WorkbenchScaffold>
