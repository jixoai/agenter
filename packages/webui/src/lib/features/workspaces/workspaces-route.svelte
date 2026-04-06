<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { SplitView } from '@agenter/svelte-components';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { resolveAsyncSurfaceState } from '@agenter/web-components';
	import type { CachedResourceState, WorkspaceAvatarCatalogEntry } from '@agenter/client-sdk';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import AdaptiveIconButton from '$lib/components/web-components/adaptive-icon-button.svelte';
	import AsyncSurface from '$lib/components/web-components/async-surface.svelte';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import { readOpenAvatarTabs, upsertOpenAvatarTab } from '$lib/features/avatars/avatar-open-tabs-state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import {
		describeCompactWorkspace,
		resolveObjectiveWorkspacePath,
		sortWorkspacesForCatalog,
	} from './workspace-sorting';

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
	const copyAvatarInputId = `copy-avatar-${crypto.randomUUID()}`;

	const sortedWorkspaces = $derived(
		sortWorkspacesForCatalog(controller.runtimeState.workspaces, controller.runtimeState.recentWorkspaces),
	);

	const preferredWorkspace = $derived(
		sortedWorkspaces.find((workspace) => workspace.path !== '~/') ?? sortedWorkspaces[0] ?? null,
	);
	const selectedWorkspace = $derived(
		sortedWorkspaces.find((workspace) => workspace.path === selectedWorkspacePath) ?? preferredWorkspace ?? null,
	);
	const selectedWorkspaceObjectivePath = $derived(
		selectedWorkspace ? resolveObjectiveWorkspacePath(selectedWorkspace, sortedWorkspaces) : null,
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
		await goto(`/avatars/workspace?path=${encodeURIComponent(path)}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
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
			await goto(`/avatars/runtime/${encodeURIComponent(session.id)}/attention`);
		} finally {
			createBusy = false;
		}
	};

	const openAvatarTab = async (): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry) {
			return;
		}
		const next = upsertOpenAvatarTab(readOpenAvatarTabs(), {
			workspacePath: selectedWorkspace.path,
			avatarNickname: selectedAvatarEntry.nickname,
		});
		await goto(next.entry.href, {
			noScroll: true,
			keepFocus: true,
		});
	};

	const openCopyDialog = (): void => {
		if (!selectedWorkspace || !selectedAvatarEntry) {
			return;
		}
		copyAvatarDraft = `${selectedAvatarEntry.nickname}-copy`;
		copyDialogOpen = true;
	};

	const submitCopyAvatar = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		const workspacePath = selectedWorkspace?.path;
		const sourceAvatar = selectedAvatarEntry?.nickname;
		const targetAvatar = copyAvatarDraft.trim();
		if (!workspacePath || !sourceAvatar || targetAvatar.length === 0 || copyBusy) {
			return;
		}
		copyBusy = true;
		const previousAvatar = selectedAvatar;
		const copyPromise = controller.runtimeStore.copyWorkspaceAvatar({
			workspacePath,
			sourceAvatar,
			targetAvatar,
		});
		selectedAvatar = targetAvatar;
		try {
			const created = await copyPromise;
			selectedAvatar = created.nickname;
			copyAvatarDraft = created.nickname;
			copyDialogOpen = false;
		} catch (error) {
			selectedAvatar = previousAvatar;
			throw error;
		} finally {
			copyBusy = false;
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

<SplitView.Root variant="sidebar-content" data-testid="workspaces-route">
	<SplitView.Sidebar>
		<WorkbenchScaffold tone="pane" body="scroll" contentClass="divide-y px-0 py-0">
			{#snippet header()}
				<h1 class="text-base font-semibold">Workspaces</h1>
			{/snippet}

			{#each sortedWorkspaces as workspace (workspace.path)}
				<button
					class={`grid w-full gap-2 px-4 py-4 text-left transition-colors hover:bg-muted/35 ${
						selectedWorkspace?.path === workspace.path ? 'bg-primary/5' : ''
					}`}
					onclick={() => void syncWorkspaceSelection(workspace.path)}
				>
					<div class="flex items-center justify-between gap-3">
						<div class="min-w-0">
							<div class="truncate text-sm font-semibold">{describeCompactWorkspace(workspace.path)}</div>
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
		</WorkbenchScaffold>
	</SplitView.Sidebar>

	<SplitView.Content>
		<WorkbenchScaffold tone="pane" body="scroll" contentClass="grid gap-4 p-4">
			{#snippet header()}
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="grid gap-2">
						<div class="flex items-center gap-2">
							<h2 class="text-base font-semibold">Quick Start</h2>
							<HelpHint textContext="Quick Start lets you pick a workspace avatar, open it in a dedicated tab, copy it, and launch a fresh runtime immediately.">
								<p>Pick a workspace avatar, open it in a tab, copy it into the workspace, or launch it immediately.</p>
							</HelpHint>
						</div>
						<div class="grid gap-1">
							<div class="text-sm font-medium text-foreground">Avatar catalog</div>
							<p class="text-sm text-muted-foreground">
								{selectedWorkspaceObjectivePath ?? 'Select a workspace to inspect its available avatars.'}
							</p>
						</div>
					</div>
				</div>
			{/snippet}

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
								selectedAvatar === avatar.nickname ? 'border-primary bg-primary/5' : 'bg-card/75'
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

			{#snippet footer()}
				<div class="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div class="text-sm font-medium text-foreground">
						{selectedWorkspaceObjectivePath ?? 'No workspace selected'}
						{#if selectedAvatarEntry}
							<span class="text-muted-foreground"> · {selectedAvatarEntry.nickname}</span>
						{/if}
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<AdaptiveIconButton
							label="Open avatar"
							tooltip="Open avatar in a dedicated workbench tab"
							disabled={!selectedAvatarEntry}
							onclick={() => void openAvatarTab()}
						>
							<EyeIcon class="size-4" />
						</AdaptiveIconButton>
						<AdaptiveIconButton
							label="Copy avatar"
							tooltip="Create a workspace-local full copy"
							disabled={!selectedWorkspace || !selectedAvatarEntry}
							onclick={openCopyDialog}
						>
							<CopyIcon class="size-4" />
						</AdaptiveIconButton>
						<Button onclick={() => void startAvatarSession()} disabled={!selectedWorkspace || createBusy}>
							<PlayIcon class="size-4" />
							{createBusy ? 'Starting…' : 'Start avatar'}
						</Button>
					</div>
				</div>
			{/snippet}
		</WorkbenchScaffold>
	</SplitView.Content>
</SplitView.Root>

<Dialog.Root bind:open={copyDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<form class="grid gap-4" onsubmit={submitCopyAvatar}>
			<Dialog.Header>
				<Dialog.Title>Copy avatar</Dialog.Title>
				<Dialog.Description>
					Create a workspace-local full copy so you can diverge from the existing avatar without mutating the original.
				</Dialog.Description>
			</Dialog.Header>

			<div class="grid gap-3">
				<Label class="grid gap-2" for={copyAvatarInputId}>
					<span>New avatar nickname</span>
					<Input id={copyAvatarInputId} bind:value={copyAvatarDraft} placeholder="ops-assistant-copy" />
				</Label>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="ghost" onclick={() => (copyDialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={copyBusy || copyAvatarDraft.trim().length === 0}>
					{copyBusy ? 'Copying…' : 'Copy avatar'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
