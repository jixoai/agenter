<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import PlayIcon from '@lucide/svelte/icons/play';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

import { getAppControllerContext } from '$lib/app/controller-context';
import ScrollView from '$lib/components/scroll-view.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { describeWorkspace, sortWorkspacesForCatalog } from './workspace-sorting';

	const controller = getAppControllerContext();

	let selectedWorkspacePath = $state(page.url.searchParams.get('path') ?? '');
	let avatars = $state<Awaited<ReturnType<typeof controller.runtimeStore.listWorkspaceAvatarCatalog>>>([]);
	let avatarLoading = $state(false);
	let selectedAvatar = $state('default');
	let createBusy = $state(false);
	let copyDialogOpen = $state(false);
	let copyAvatarDraft = $state('');

	const sortedWorkspaces = $derived(
		sortWorkspacesForCatalog(controller.runtimeState.workspaces, controller.runtimeState.recentWorkspaces),
	);

	const selectedWorkspace = $derived(
		sortedWorkspaces.find((workspace) => workspace.path === selectedWorkspacePath) ?? sortedWorkspaces[0] ?? null,
	);

	const selectedAvatarEntry = $derived(
		avatars.find((avatar) => avatar.nickname === selectedAvatar) ?? avatars[0] ?? null,
	);

	const syncWorkspaceSelection = async (path: string): Promise<void> => {
		selectedWorkspacePath = path;
		await goto(`/workspaces?path=${encodeURIComponent(path)}`, { replaceState: true, noScroll: true, keepFocus: true });
	};

	const loadAvatars = async (workspacePath: string): Promise<void> => {
		avatarLoading = true;
		try {
			avatars = await controller.runtimeStore.listWorkspaceAvatarCatalog(workspacePath);
			if (!avatars.some((avatar) => avatar.nickname === selectedAvatar)) {
				selectedAvatar = avatars[0]?.nickname ?? 'default';
			}
		} finally {
			avatarLoading = false;
		}
	};

	const startAvatarSession = async (): Promise<void> => {
		if (!selectedWorkspace) {
			return;
		}
		createBusy = true;
		try {
			await controller.runtimeStore.createSession({
				cwd: selectedWorkspace.path,
				avatar: selectedAvatar,
				autoStart: true,
			});
			await controller.refreshBootstrap();
		} finally {
			createBusy = false;
		}
	};

	$effect(() => {
		if (!sortedWorkspaces.length) {
			return;
		}
		if (!selectedWorkspacePath || !sortedWorkspaces.some((workspace) => workspace.path === selectedWorkspacePath)) {
			void syncWorkspaceSelection(sortedWorkspaces[0]!.path);
		}
	});

	$effect(() => {
		if (selectedWorkspace?.path) {
			void loadAvatars(selectedWorkspace.path);
		}
	});
</script>

<div class="grid h-full min-h-0 gap-4 p-4 md:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)] md:p-6">
	<Card class="min-h-0 py-0">
		<CardHeader class="gap-2 border-b">
			<CardTitle>Workspaces</CardTitle>
			<CardDescription>
				Global workspace first, then favorites, then most recently active workspaces with started sessions.
			</CardDescription>
		</CardHeader>
		<CardContent class="min-h-0 flex-1 p-0">
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
		</CardContent>
	</Card>

	<div class="grid min-h-0 gap-4 md:grid-rows-[auto_minmax(0,1fr)]">
		<Card class="py-0">
			<CardHeader class="gap-2 border-b">
				<div class="flex items-center justify-between gap-3">
					<div>
						<CardTitle>Quick Start</CardTitle>
						<CardDescription>Choose one workspace, choose one avatar, then launch the stable avatar session.</CardDescription>
					</div>
					<Button variant="outline" size="icon-sm" onclick={() => void controller.refreshBootstrap()} aria-label="Refresh workspaces">
						<FolderPlusIcon class="size-4" />
					</Button>
				</div>
			</CardHeader>
			<CardContent class="grid gap-4 p-4">
				<div class="rounded-2xl border bg-muted/30 p-4">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Selected workspace</div>
					<div class="mt-2 text-sm font-semibold">{selectedWorkspace ? describeWorkspace(selectedWorkspace.path) : 'No workspace'}</div>
				</div>

				<div class="grid gap-3">
					<div class="flex items-center justify-between gap-3">
						<div>
							<div class="text-sm font-semibold">Avatar catalog</div>
							<div class="text-xs text-muted-foreground">
								Select an existing avatar. Copy creates a full workspace-local duplicate for editing.
							</div>
						</div>
						<Button
							variant="outline"
							size="icon-sm"
							onclick={() => {
								copyAvatarDraft = `${selectedAvatar}-copy`;
								copyDialogOpen = true;
							}}
							disabled={!selectedWorkspace || !selectedAvatarEntry}
							aria-label="Copy avatar"
							title="Copy avatar"
						>
							<CopyIcon class="size-4" />
						</Button>
					</div>

					<div class="grid gap-2 md:grid-cols-2">
						{#if avatarLoading}
							<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Loading avatars…</div>
						{:else}
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
						{/if}
					</div>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
					<div class="flex items-start gap-3">
						<SparklesIcon class="mt-0.5 size-5 text-primary" />
						<div>
							<div class="text-sm font-semibold">Stable session</div>
							<div class="text-xs text-muted-foreground">
								Session id remains stable for the same workspace and avatar pair.
							</div>
						</div>
					</div>
					<Button onclick={() => void startAvatarSession()} disabled={!selectedWorkspace || createBusy}>
						<PlayIcon class="size-4" />
						{createBusy ? 'Starting…' : 'Start avatar'}
					</Button>
				</div>
			</CardContent>
		</Card>

		<Card class="min-h-0 py-0">
			<CardHeader class="gap-2 border-b">
				<CardTitle>Workspace facts</CardTitle>
				<CardDescription>Keep the selection visible and factual. No hidden workspace/session coupling.</CardDescription>
			</CardHeader>
			<CardContent class="min-h-0 p-0">
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
			</CardContent>
		</Card>
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
					const created = await controller.runtimeStore.copyWorkspaceAvatar({
						workspacePath: selectedWorkspace.path,
						sourceAvatar: selectedAvatarEntry.nickname,
						targetAvatar: copyAvatarDraft,
					});
					selectedAvatar = created.nickname;
					copyDialogOpen = false;
					await loadAvatars(selectedWorkspace.path);
				}}
			>
				Copy avatar
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
