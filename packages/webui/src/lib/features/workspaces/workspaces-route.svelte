<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import PlayIcon from '@lucide/svelte/icons/play';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import { resolveAsyncSurfaceState } from '@agenter/web-components';
	import type { CachedResourceState, WorkspaceAvatarCatalogEntry } from '@agenter/client-sdk';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import PanelShell from '$lib/components/panel-shell.svelte';
	import AdaptiveIconButton from '$lib/components/web-components/adaptive-icon-button.svelte';
	import AsyncSurface from '$lib/components/web-components/async-surface.svelte';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import ScrollView from '$lib/components/scroll-view.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { describeWorkspace, sortWorkspacesForCatalog } from './workspace-sorting';

	const controller = getAppControllerContext();
	const emptyAvatarCatalogState: CachedResourceState<WorkspaceAvatarCatalogEntry[]> = {
		data: [],
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};

	let selectedWorkspacePath = $state(page.url.searchParams.get('path') ?? '');
	let selectedAvatar = $state('default');
	let createBusy = $state(false);
	let copyDialogOpen = $state(false);
	let copyBusy = $state(false);
	let copyAvatarDraft = $state('');
	let detailsDialogOpen = $state(false);

	const sortedWorkspaces = $derived(
		sortWorkspacesForCatalog(controller.runtimeState.workspaces, controller.runtimeState.recentWorkspaces),
	);

	const preferredWorkspace = $derived(
		sortedWorkspaces.find((workspace) => workspace.path !== '~/') ?? sortedWorkspaces[0] ?? null,
	);
	const selectedWorkspace = $derived(
		sortedWorkspaces.find((workspace) => workspace.path === selectedWorkspacePath) ?? preferredWorkspace ?? null,
	);
	const selectedWorkspaceAvatarCatalog = $derived(
		selectedWorkspace
			? (controller.runtimeState.workspaceAvatarCatalogByPath[selectedWorkspace.path] ?? emptyAvatarCatalogState)
			: emptyAvatarCatalogState,
	);
	const avatars = $derived(selectedWorkspaceAvatarCatalog.data);
	const avatarLoading = $derived(selectedWorkspaceAvatarCatalog.loading && !selectedWorkspaceAvatarCatalog.loaded);
	const avatarSurfaceState = $derived(
		resolveAsyncSurfaceState({
			loading: avatarLoading,
			hasData: avatars.length > 0,
		}),
	);

	const selectedAvatarEntry = $derived(
		avatars.find((avatar) => avatar.nickname === selectedAvatar) ?? avatars[0] ?? null,
	);

	const syncWorkspaceSelection = async (path: string): Promise<void> => {
		selectedWorkspacePath = path;
		await goto(`/workspaces?path=${encodeURIComponent(path)}`, { replaceState: true, noScroll: true, keepFocus: true });
	};

	const startAvatarSession = async (): Promise<void> => {
		if (!selectedWorkspace) {
			return;
		}
		createBusy = true;
		try {
			const session = await controller.runtimeStore.createSession({
				cwd: selectedWorkspace.path,
				avatar: selectedAvatar,
				autoStart: true,
			});
			await goto(`/runtime/${encodeURIComponent(session.id)}/attention`);
		} finally {
			createBusy = false;
		}
	};

	$effect(() => {
		if (!sortedWorkspaces.length) {
			return;
		}
		if (!selectedWorkspacePath || !sortedWorkspaces.some((workspace) => workspace.path === selectedWorkspacePath)) {
			void syncWorkspaceSelection(preferredWorkspace?.path ?? sortedWorkspaces[0]!.path);
		}
	});

	$effect(() => {
		const workspacePath = selectedWorkspace?.path;
		if (!workspacePath) {
			return;
		}
		const release = controller.runtimeStore.retainWorkspaceAvatarCatalog(workspacePath);
		void controller.runtimeStore.hydrateWorkspaceAvatarCatalog(workspacePath);
		return () => {
			release();
		};
	});

	$effect(() => {
		if (!avatars.length) {
			selectedAvatar = 'default';
			return;
		}
		if (!avatars.some((avatar) => avatar.nickname === selectedAvatar)) {
			selectedAvatar = avatars[0]?.nickname ?? 'default';
		}
	});
</script>

<div class="grid h-full gap-4 p-4 md:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)] md:p-6">
	<PanelShell>
		{#snippet header()}
			<h1 class="text-base font-semibold">Workspaces</h1>
			<p class="text-sm text-muted-foreground">
				Global workspace first, then favorites, then most recently active workspaces with started sessions.
			</p>
		{/snippet}

		<ScrollView class="h-full" contentClass="divide-y">
			{#each sortedWorkspaces as workspace (workspace.path)}
				<button
					class={`grid w-full gap-2 px-4 py-4 text-left transition-colors hover:bg-muted/50 ${
						selectedWorkspace?.path === workspace.path ? 'bg-primary/5' : ''
					}`}
					onclick={() => void syncWorkspaceSelection(workspace.path)}
				>
					<div class="flex items-center justify-between gap-3">
						<div class="min-w-0">
							<div class="truncate text-sm font-semibold">{workspace.path === '~/' ? 'Global workspace' : workspace.path}</div>
							<div class="truncate text-xs text-muted-foreground">
								{workspace.group} · {workspace.counts.running} running · {workspace.counts.all} total
							</div>
						</div>
						{#if workspace.favorite}
							<div class="rounded-full border px-2 py-1 text-[11px]">Favorite</div>
						{/if}
					</div>
					{#if workspace.lastSessionActivityAt}
						<div class="text-[11px] text-muted-foreground">Last used {workspace.lastSessionActivityAt}</div>
					{/if}
				</button>
			{/each}
		</ScrollView>
	</PanelShell>

	<div class="grid gap-4 md:grid-rows-[auto_minmax(0,1fr)]">
		<Card.Root>
			<Card.Header class="gap-2 border-b">
				<div class="flex items-center justify-between gap-3">
					<div>
						<Card.Title>Quick Start</Card.Title>
						<Card.Description>Choose one workspace, choose one avatar, then launch the stable avatar session.</Card.Description>
					</div>
					<Button variant="outline" size="icon-sm" onclick={() => void controller.refreshBootstrap()} aria-label="Refresh workspaces">
						<FolderPlusIcon class="size-4" />
					</Button>
				</div>
			</Card.Header>
			<Card.Content class="grid gap-4">
				<div class="rounded-2xl border bg-muted/30 p-4">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Selected workspace</div>
					<div class="mt-2 text-sm font-semibold">{selectedWorkspace ? describeWorkspace(selectedWorkspace.path) : 'No workspace'}</div>
				</div>

				<div class="grid gap-3">
					<div class="flex items-center justify-between gap-3">
						<div>
							<div class="flex items-center gap-2 text-sm font-semibold">
								<span>Avatar catalog</span>
								<HelpHint textContext="workspace avatar catalog selects an existing avatar and copy creates a workspace-local duplicate.">
									<p>Select an existing avatar. Copy creates a full workspace-local duplicate for editing.</p>
								</HelpHint>
							</div>
						</div>
					</div>

					<AsyncSurface
						state={avatarSurfaceState}
						emptyLoadingLabel="Loading avatars…"
						loadingOverlayLabel="Refreshing avatars…"
					>
						{#snippet empty()}
							{#if selectedWorkspaceAvatarCatalog.error}
								<div class="rounded-2xl border border-dashed p-4 text-sm text-destructive">
									{selectedWorkspaceAvatarCatalog.error}
								</div>
							{:else}
								<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
									No avatars available for this workspace.
								</div>
							{/if}
						{/snippet}

						<div class="grid gap-2 md:grid-cols-2">
							{#each avatars as avatar (avatar.nickname)}
								<button
									class={`rounded-2xl border p-4 text-left transition-colors hover:bg-muted/40 ${
										selectedAvatar === avatar.nickname ? 'border-primary bg-primary/5' : 'bg-card'
									}`}
									onclick={() => {
										selectedAvatar = avatar.nickname;
									}}
								>
									<div class="flex items-center justify-between gap-2">
										<div class="truncate text-sm font-semibold">{avatar.nickname}</div>
										{#if avatar.defaultAvatar}
											<div class="rounded-full border px-2 py-1 text-[11px]">Default</div>
										{/if}
									</div>
									<div class="mt-2 text-xs text-muted-foreground">
										{avatar.sourceScope === 'workspace' ? 'Workspace-local copy' : 'Global source'}
									</div>
								</button>
							{/each}
						</div>
					</AsyncSurface>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
					<div class="flex items-start gap-3">
						<SparklesIcon class="mt-0.5 size-5 text-primary" />
						<div>
							<div class="flex items-center gap-2 text-sm font-semibold">
								<span>Stable session</span>
								<HelpHint textContext="stable avatar sessions keep the same session id for the same workspace avatar pair.">
									<p>Session id remains stable for the same workspace and avatar pair.</p>
								</HelpHint>
							</div>
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<AdaptiveIconButton
							label="Details"
							tooltip="View avatar source paths"
							disabled={!selectedAvatarEntry}
							onclick={() => {
								detailsDialogOpen = true;
							}}
						>
							<EyeIcon class="size-4" />
						</AdaptiveIconButton>
						<AdaptiveIconButton
							label="Copy avatar"
							tooltip="Create a workspace-local full copy"
							disabled={!selectedWorkspace || !selectedAvatarEntry}
							onclick={() => {
								copyAvatarDraft = `${selectedAvatar}-copy`;
								copyDialogOpen = true;
							}}
						>
							<CopyIcon class="size-4" />
						</AdaptiveIconButton>
						<Button onclick={() => void startAvatarSession()} disabled={!selectedWorkspace || createBusy}>
							<PlayIcon class="size-4" />
							{createBusy ? 'Starting…' : 'Start avatar'}
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<PanelShell bodyClass="h-full">
			{#snippet header()}
				<h2 class="text-base font-semibold">Workspace facts</h2>
				<p class="text-sm text-muted-foreground">Keep the selection visible and factual. No hidden workspace/session coupling.</p>
			{/snippet}

			<ScrollView class="h-full" contentClass="grid gap-3 p-4">
					{#if selectedWorkspace}
						<div class="rounded-2xl border bg-muted/30 p-4">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Path</div>
							<div class="mt-2 break-all text-sm font-medium">{selectedWorkspace.path}</div>
						</div>
						<div class="rounded-2xl border bg-muted/30 p-4">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Counts</div>
							<div class="mt-2 grid gap-2 text-sm md:grid-cols-3">
								<div>Running: {selectedWorkspace.counts.running}</div>
								<div>Stopped: {selectedWorkspace.counts.stopped}</div>
								<div>Archive: {selectedWorkspace.counts.archive}</div>
							</div>
						</div>
						<div class="rounded-2xl border bg-muted/30 p-4">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Activity</div>
							<div class="mt-2 text-sm">{selectedWorkspace.lastSessionActivityAt ?? 'No started sessions yet'}</div>
						</div>
					{:else}
						<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No workspace selected.</div>
					{/if}
			</ScrollView>
		</PanelShell>
	</div>
</div>

<Dialog.Root bind:open={copyDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Copy avatar</Dialog.Title>
			<Dialog.Description>
				Create a workspace-local full copy so you can diverge from the existing avatar without mutating the original.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-3">
			<label class="grid gap-2 text-sm font-medium">
				<span>New avatar nickname</span>
				<Input bind:value={copyAvatarDraft} placeholder="ops-assistant-copy" />
			</label>
		</div>

		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (copyDialogOpen = false)}>Cancel</Button>
			<Button
				onclick={async () => {
					if (!selectedWorkspace || !selectedAvatarEntry || !copyAvatarDraft.trim()) {
						return;
					}
					copyBusy = true;
					selectedAvatar = copyAvatarDraft.trim();
					try {
						const created = await controller.runtimeStore.copyWorkspaceAvatar({
							workspacePath: selectedWorkspace.path,
							sourceAvatar: selectedAvatarEntry.nickname,
							targetAvatar: copyAvatarDraft,
						});
						selectedAvatar = created.nickname;
						copyDialogOpen = false;
					} finally {
						copyBusy = false;
					}
				}}
				disabled={copyBusy}
			>
				{copyBusy ? 'Copying…' : 'Copy avatar'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={detailsDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Avatar details</Dialog.Title>
			<Dialog.Description>
				Objective catalog facts for the currently selected avatar.
			</Dialog.Description>
		</Dialog.Header>

		{#if selectedAvatarEntry}
			<div class="grid gap-3 text-sm">
				<div class="rounded-2xl border bg-muted/30 p-4">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Nickname</div>
					<div class="mt-2 font-semibold">{selectedAvatarEntry.nickname}</div>
				</div>
				<div class="rounded-2xl border bg-muted/30 p-4">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scope</div>
					<div class="mt-2">{selectedAvatarEntry.sourceScope}</div>
				</div>
				<div class="rounded-2xl border bg-muted/30 p-4">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Effective path</div>
					<div class="mt-2 break-all font-medium">{selectedAvatarEntry.effectivePath}</div>
				</div>
				<div class="rounded-2xl border bg-muted/30 p-4">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workspace path</div>
					<div class="mt-2 break-all">{selectedAvatarEntry.workspacePath}</div>
				</div>
				<div class="rounded-2xl border bg-muted/30 p-4">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Global path</div>
					<div class="mt-2 break-all">{selectedAvatarEntry.globalPath}</div>
				</div>
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (detailsDialogOpen = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
