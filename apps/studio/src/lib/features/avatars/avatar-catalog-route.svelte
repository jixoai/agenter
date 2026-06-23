<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import BotIcon from '@lucide/svelte/icons/bot';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { ScrollView } from '@agenter/svelte-components';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import AvatarLoadingSkeleton from './avatar-loading-skeleton.svelte';
	import { cn } from '$lib/utils.js';
	import { buildAvatarCatalogHref, buildAvatarNewHref } from './avatar-workbench-location';
	import { createAvatarCreateDraft } from './avatar-create-draft-resource';
	import { buildWorkspaceIndexHref } from '$lib/features/workspaces/workspace-location';

	const controller = getAppControllerContext();
	type AvatarCatalogEntry = (typeof controller.runtimeState.globalAvatarCatalog.data)[number];

	let selectedAvatar = $state(page.url.searchParams.get('avatar') ?? '');
	let runtimeBusy = $state(false);
	let runtimeError = $state<string | null>(null);
	let draftBusy = $state(false);
	let draftError = $state<string | null>(null);
	let copyDialogOpen = $state(false);
	let copyNickname = $state('');
	let copyBusy = $state(false);
	let copyError = $state<string | null>(null);
	let detailCompact = $state(false);
	let detailOpen = $state(true);
	let routeSyncReady = $state(false);

	const catalogState = $derived(controller.runtimeState.globalAvatarCatalog);
	const avatars = $derived(catalogState.data);
	const catalogCountLabel = $derived(`${avatars.length} installed`);
	const catalogLoadingWithoutData = $derived(!catalogState.loaded && catalogState.loading && avatars.length === 0);
	const catalogRefreshingWithData = $derived(catalogState.refreshing && avatars.length > 0);
	const catalogEmpty = $derived(catalogState.loaded && avatars.length === 0);
	const selectedEntry = $derived(
		avatars.find((entry) => entry.nickname === selectedAvatar) ?? avatars[0] ?? null,
	);
	const selectedSession = $derived(
		selectedEntry
			? controller.runtimeState.sessions.find((session) => session.id === selectedEntry.runtimeId) ?? null
			: null,
	);
	const selectedStatusLabel = $derived(selectedSession?.status ?? 'stopped');
	const selectedSessionActive = $derived(
		selectedSession?.status === 'running' || selectedSession?.status === 'starting',
	);
	const selectedOriginLabel = $derived(selectedEntry ? 'Local catalog' : null);
	const workspaceSlotMatchesRoot = $derived(
		selectedEntry ? selectedEntry.workspacePrivatePath === selectedEntry.globalPath : false,
	);
	const primaryActionLabel = $derived.by(() => {
		if (runtimeBusy) {
			return selectedSessionActive ? 'Opening attention…' : 'Starting avatar…';
		}
		return selectedSessionActive ? 'Open attention' : 'Start avatar';
	});
	const copyNicknameConflict = $derived(
		copyNickname.trim().length > 0 &&
			avatars.some((avatar) => avatar.nickname === copyNickname.trim().toLowerCase()),
	);

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalAvatarCatalog();
		void controller.runtimeStore.hydrateGlobalAvatarCatalog();
		return () => {
			release();
		};
	});

	$effect(() => {
		if (!selectedEntry) {
			return;
		}
		if (selectedAvatar !== selectedEntry.nickname) {
			selectedAvatar = selectedEntry.nickname;
		}
	});

	const syncRoute = (): void => {
		if (!routeSyncReady) {
			return;
		}
		const nextHref = buildAvatarCatalogHref({ avatar: selectedEntry?.nickname ?? selectedAvatar });
		const currentHref = `${page.url.pathname}${page.url.search}`;
		if (nextHref === currentHref) {
			return;
		}
		replaceState(nextHref, page.state);
	};

	$effect(() => {
		syncRoute();
	});

	onMount(() => {
		routeSyncReady = true;
	});

	const compactRuntimeId = (runtimeId: string): string => {
		const prefix = runtimeId.slice(0, 8);
		return runtimeId.length > 8 ? `${prefix}…` : prefix;
	};

	const formatStatusLabel = (status: string): string => {
		return status.length > 0 ? `${status.slice(0, 1).toUpperCase()}${status.slice(1)}` : status;
	};

	const selectAvatar = (nickname: string): void => {
		selectedAvatar = nickname;
		detailOpen = true;
	};

	const openAvatarDraft = async (): Promise<void> => {
		if (!selectedEntry || draftBusy) {
			return;
		}
		draftBusy = true;
		draftError = null;
		try {
			const created = await createAvatarCreateDraft(controller.runtimeStore, {
				sourceAvatarNickname: selectedEntry.nickname,
			});
			await goto(
				buildAvatarNewHref({
					draftId: created.resource.draftId,
					sourceAvatarNickname: selectedEntry.nickname,
				}),
				{
					keepFocus: true,
					noScroll: true,
				},
			);
		} catch (error) {
			draftError = error instanceof Error ? error.message : 'Failed to create avatar draft.';
		} finally {
			draftBusy = false;
		}
	};

	const openAvatarRuntime = async (input: { autoStart: boolean; tab: 'heartbeat' | 'attention' }): Promise<void> => {
		if (!selectedEntry || runtimeBusy) {
			return;
		}
		runtimeBusy = true;
		runtimeError = null;
		try {
			const session =
				selectedSession ??
				(await controller.runtimeStore.createSession({
					cwd: selectedEntry.globalPath,
					avatar: selectedEntry.nickname,
					autoStart: input.autoStart,
				}));
			if (input.autoStart && session.status !== 'running' && session.status !== 'starting') {
				await controller.runtimeStore.startSession(session.id);
			}
			await goto(`/avatars/runtime/${encodeURIComponent(session.id)}/${input.tab}`);
		} catch (error) {
			runtimeError = error instanceof Error ? error.message : 'Failed to open avatar runtime.';
		} finally {
			runtimeBusy = false;
		}
	};

	const submitAvatarCopy = async (): Promise<void> => {
		const nickname = copyNickname.trim();
		if (!selectedEntry || nickname.length === 0 || copyBusy || copyNicknameConflict) {
			return;
		}
		copyBusy = true;
		copyError = null;
		try {
			const created = await controller.runtimeStore.createGlobalAvatar({
				nickname,
				displayName: nickname,
			});
			selectedAvatar = created.nickname;
			detailOpen = true;
			copyDialogOpen = false;
			copyNickname = '';
		} catch (error) {
			copyError = error instanceof Error ? error.message : 'Failed to copy avatar.';
		} finally {
			copyBusy = false;
		}
	};

	const openCopyAvatarDialog = (): void => {
		copyDialogOpen = true;
		copyNickname = '';
		copyError = null;
	};
</script>

{#snippet avatarCatalogEntry(entry: AvatarCatalogEntry)}
	{@const isSelected = selectedEntry?.runtimeId === entry.runtimeId}
	<button
		type="button"
		class={cn(
			'grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-3 text-left transition-colors md:px-4 md:py-3.5',
			isSelected ? 'bg-accent/45' : 'hover:bg-muted/24',
		)}
		aria-pressed={isSelected}
		onclick={() => {
			selectAvatar(entry.nickname);
		}}
	>
		<ProfileAvatar
			label={entry.nickname}
			src={entry.iconUrl ?? null}
			class="size-9 rounded-xl border-border/65 bg-background/70"
		/>
		<div class="grid min-w-0 gap-0.5">
			<div class="truncate text-sm font-semibold">{entry.nickname}</div>
			<div class="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4 text-muted-foreground">
				<span>{compactRuntimeId(entry.runtimeId)}</span>
				{#if entry.defaultAvatar}
					<span aria-hidden="true">·</span>
					<span>Default</span>
				{/if}
			</div>
		</div>
	</button>
{/snippet}

<div
	class="h-full min-w-0"
	data-testid="avatar-catalog-route"
>
	<WorkbenchPageContent
		class="h-full min-w-0"
		detailLayout="split-detail"
		bind:detailCompact
		bind:detailOpen
		detailRatioPersistence="avatars:catalog-detail"
		detailLeftMin={280}
		detailRightMin={360}
		detailDefaultRatio={0.34}
	>
		{#snippet main()}
			<Card.Root class="h-full gap-0 rounded-none border-0 bg-transparent py-0 shadow-none">
				<Card.Header class="gap-2 border-b px-3 py-3.5 md:px-5 md:py-4.5">
					<div class="flex items-start justify-between gap-3">
						<div class="grid gap-1">
							<Card.Title>My avatars</Card.Title>
							<Card.Description class="max-w-[28rem] text-xs leading-5 md:text-sm">
								{catalogCountLabel}. Select one installed avatar to inspect its runtime identity and operational handoffs.
							</Card.Description>
						</div>

						{#if catalogRefreshingWithData}
							<div
								class="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/72 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
								data-testid="avatar-catalog-refreshing"
							>
								<span class="size-1.5 rounded-full bg-amber-500"></span>
								Refreshing
							</div>
						{/if}

						{#if detailCompact && selectedEntry}
							<Button
								variant="outline"
								size="sm"
								class="shrink-0"
								onclick={() => {
									detailOpen = true;
								}}
							>
								<PanelRightOpenIcon class="size-4" />
								<span class="hidden sm:inline">Open detail</span>
							</Button>
						{/if}
					</div>
				</Card.Header>

				<Card.Content class="h-full p-0">
					{#if catalogLoadingWithoutData}
						<ScrollView class="h-full">
							<AvatarLoadingSkeleton variant="catalog-list" />
						</ScrollView>
					{:else if catalogEmpty}
						<div class="grid h-full place-items-center p-6">
							<div class="grid max-w-sm gap-2 text-center">
								<div class="text-sm font-semibold">No avatars yet</div>
								<div class="text-sm text-muted-foreground">
									{catalogState.error ?? 'Install or create one avatar to start a runtime lens.'}
								</div>
							</div>
						</div>
					{:else}
						<ScrollView class="h-full" contentClass="divide-y divide-border/50">
							{#each avatars as entry (entry.runtimeId)}
								{@render avatarCatalogEntry(entry)}
							{/each}
						</ScrollView>
					{/if}
				</Card.Content>
			</Card.Root>
		{/snippet}

		{#snippet drawer()}
			{#snippet avatarDrawerSummary()}
				{#if selectedEntry}
					<div><span class="font-medium text-foreground">Status:</span> {formatStatusLabel(selectedStatusLabel)}</div>
					<div><span class="font-medium text-foreground">Catalog:</span> {selectedEntry.defaultAvatar ? 'Default avatar' : 'Installed avatar'}</div>
					<div><span class="font-medium text-foreground">Runtime:</span> {compactRuntimeId(selectedEntry.runtimeId)}</div>
				{:else}
					<div>Select one avatar to preview it here.</div>
				{/if}
			{/snippet}

			<WorkbenchDetailDrawer
				tone={detailCompact ? 'page' : 'pane'}
				title={selectedEntry ? selectedEntry.nickname : 'Selected avatar'}
				description={catalogRefreshingWithData ? 'Refreshing catalog facts.' : 'Preview before runtime entry.'}
				summary={avatarDrawerSummary}
			>
				{#if catalogLoadingWithoutData}
					<AvatarLoadingSkeleton variant="catalog-detail" />
				{:else if !selectedEntry}
					<div class="text-sm text-muted-foreground">Select one installed avatar from the list to inspect its runtime identity.</div>
				{:else}
					{#if runtimeError}
						<NoticeBanner tone="warning" title="Avatar runtime failed" message={runtimeError} />
					{/if}

					{#if draftError}
						<NoticeBanner tone="warning" title="Avatar draft failed" message={draftError} />
					{/if}

					<div class="grid gap-4">
						<div class="flex items-start gap-3">
							<ProfileAvatar
								label={selectedEntry.nickname}
								src={selectedEntry.iconUrl ?? null}
								class="size-12 rounded-xl border-border/65 bg-background/70 md:size-14"
							/>
							<div class="grid min-w-0 gap-1">
								<div class="grid min-w-0 gap-0.5 md:flex md:flex-wrap md:items-baseline md:gap-x-2 md:gap-y-1">
									<h2 class="truncate text-lg font-semibold md:text-xl">{selectedEntry.nickname}</h2>
									<div class="flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-muted-foreground md:text-xs">
										<span>{formatStatusLabel(selectedStatusLabel)}</span>
										{#if selectedEntry.defaultAvatar}
											<span aria-hidden="true">·</span>
											<span>Default</span>
										{/if}
									</div>
								</div>
								<div class="text-[11px] leading-4 text-muted-foreground md:text-xs">
									Runtime {compactRuntimeId(selectedEntry.runtimeId)}
								</div>
							</div>
						</div>

						<div class="grid gap-2 sm:grid-cols-2">
							<Button
								variant="outline"
								class="w-full"
								onclick={() => void openAvatarRuntime({ autoStart: false, tab: 'heartbeat' })}
								disabled={runtimeBusy}
							>
								<BotIcon class="size-4" />
								Open avatar
							</Button>
							<Button
								class="w-full"
								onclick={() => void openAvatarRuntime({ autoStart: true, tab: 'attention' })}
								disabled={runtimeBusy}
							>
								<PlayIcon class="size-4" />
								{primaryActionLabel}
							</Button>
						</div>

						<div class="grid gap-3 rounded-[0.9rem] bg-muted/24 px-4 py-4">
							<div class="grid gap-1.5">
								<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Canonical runtime</div>
								<div class="break-all text-sm font-semibold leading-6 md:text-[15px]">
									{selectedEntry.runtimeId}
								</div>
							</div>

							<div class="grid gap-3 sm:grid-cols-2">
								<div class="grid gap-1">
									<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Origin</div>
									<div class="text-sm font-medium text-foreground/80">{selectedOriginLabel}</div>
								</div>
								<div class="grid gap-1">
									<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Catalog state</div>
									<div class="text-sm font-medium text-foreground/80">
										{selectedEntry.defaultAvatar ? 'Default avatar' : 'Installed avatar'}
									</div>
								</div>
							</div>
						</div>

						<div class="grid gap-2.5 rounded-[0.9rem] border border-border/50 px-4 py-4">
							<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Actions</div>
							<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground">
								<button
									type="button"
									class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
									disabled={draftBusy}
									onclick={() => void openAvatarDraft()}
								>
									<PlusIcon class="size-3.5" />
									{draftBusy ? 'Creating draft…' : 'Create draft from this avatar'}
								</button>
								<button
									type="button"
									class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
									onclick={() => void goto(buildWorkspaceIndexHref({ avatar: selectedEntry.nickname }))}
								>
									<ArrowUpRightIcon class="size-3.5" />
									Open workspaces
								</button>
								<button
									type="button"
									class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
									onclick={openCopyAvatarDialog}
								>
									Copy avatar
								</button>
							</div>
						</div>

						<div class="grid gap-0 rounded-[0.9rem] border border-border/50">
							<div class="border-b border-border/50 px-4 py-3 text-sm font-medium text-muted-foreground">
								Runtime details
							</div>
							<div class="grid gap-0 divide-y divide-border/50 px-4">
								{#if workspaceSlotMatchesRoot}
									<div class="grid gap-1 py-3">
										<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Runtime home</div>
										<div class="break-all font-mono text-xs leading-5 text-foreground/80">
											{selectedEntry.globalPath}
										</div>
									</div>
								{:else}
									<div class="grid gap-1 py-3">
										<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Root workspace</div>
										<div class="break-all font-mono text-xs leading-5 text-foreground/80">
											{selectedEntry.globalPath}
										</div>
									</div>
									<div class="grid gap-1 py-3">
										<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workspace slot</div>
										<div class="break-all font-mono text-xs leading-5 text-foreground/80">
											{selectedEntry.workspacePrivatePath}
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
</div>

<Dialog.Root bind:open={copyDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<form
			class="grid gap-6"
			onsubmit={(event) => {
				event.preventDefault();
				void submitAvatarCopy();
			}}
		>
			<Dialog.Header>
				<Dialog.Title>Copy avatar</Dialog.Title>
				<Dialog.Description>
					Create a new global avatar identity from the current lens. Template source stays informational until copy/import flows land.
				</Dialog.Description>
			</Dialog.Header>

			<div class="grid gap-4">
				<div class="border-b border-border/40 pb-3 text-sm text-muted-foreground">
					Source avatar: <span class="font-medium text-foreground">{selectedEntry?.nickname ?? 'Unavailable'}</span>
				</div>

				<label class="grid gap-2 text-sm font-medium">
					<span>New avatar nickname</span>
					<Input bind:value={copyNickname} placeholder="reviewer" />
				</label>

				{#if copyNicknameConflict}
					<NoticeBanner tone="warning" message="An avatar with this nickname already exists in the global catalog." />
				{/if}
				{#if copyError}
					<NoticeBanner tone="warning" title="Copy avatar failed" message={copyError} />
				{/if}
			</div>

			<Dialog.Footer>
				<Button
					type="button"
					variant="ghost"
					onclick={() => {
						copyDialogOpen = false;
					}}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					disabled={copyBusy || copyNickname.trim().length === 0 || copyNicknameConflict}
				>
					{copyBusy ? 'Copying avatar…' : 'Copy avatar'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
