<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import NotebookTextIcon from '@lucide/svelte/icons/notebook-text';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { goto } from '$app/navigation';

	import type { NoteCatalogOutput } from '@agenter/client-sdk';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbarStatus from '$lib/features/navigation/workbench-toolbar-status.svelte';
	import { cn } from '$lib/utils.js';
	import { buildNotesAvatarHref } from './notes-workbench-location';

	type CatalogByAvatar = Record<string, NoteCatalogOutput | null>;

	const controller = getAppControllerContext();
	let catalogsByAvatar = $state<CatalogByAvatar>({});
	let selectedAvatarNickname = $state('');
	let loadingCatalogs = $state(false);
	let catalogError = $state<string | null>(null);
	let detailCompact = $state(false);
	let detailOpen = $state(true);

	const avatars = $derived(controller.runtimeState.globalAvatarCatalog.data);
	const selectedEntry = $derived(
		avatars.find((entry) => entry.nickname === selectedAvatarNickname) ?? avatars[0] ?? null,
	);
	const selectedCatalog = $derived(selectedEntry ? catalogsByAvatar[selectedEntry.nickname] ?? null : null);
	const availableCount = $derived(
		Object.values(catalogsByAvatar).filter((catalog) => catalog?.capability.available === true).length,
	);

	const loadCatalogSummaries = async (): Promise<void> => {
		if (avatars.length === 0) {
			catalogsByAvatar = {};
			return;
		}
		loadingCatalogs = true;
		catalogError = null;
		try {
			const entries = await Promise.all(
				avatars.map(async (avatar) => {
					const catalog = await controller.runtimeStore.listNoteCatalog({
						avatarNickname: avatar.nickname,
						limit: 1,
					});
					return [avatar.nickname, catalog] as const;
				}),
			);
			catalogsByAvatar = Object.fromEntries(entries);
		} catch (caught) {
			catalogError = caught instanceof Error ? caught.message : 'Failed to load Notes overview.';
			catalogsByAvatar = {};
		} finally {
			loadingCatalogs = false;
		}
	};

	const selectAvatar = (nickname: string): void => {
		selectedAvatarNickname = nickname;
		detailOpen = true;
	};

	const openAvatar = async (nickname: string): Promise<void> => {
		await goto(buildNotesAvatarHref(nickname), {
			keepFocus: true,
			noScroll: true,
		});
	};

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
		if (selectedAvatarNickname !== selectedEntry.nickname) {
			selectedAvatarNickname = selectedEntry.nickname;
		}
	});

	$effect(() => {
		avatars.map((avatar) => avatar.nickname).join('\n');
		void loadCatalogSummaries();
	});
</script>

{#snippet notesOverviewToolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<NotebookTextIcon class="size-4 text-muted-foreground" />
{/snippet}

{#snippet notesOverviewToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">Notes</span>
{/snippet}

{#snippet notesOverviewToolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">Open one avatar-scoped NoteSystem tab.</span>
{/snippet}

{#snippet notesOverviewToolbarStatus(toolbarState: WorkbenchToolbarRenderState)}
	<div class={cn('flex min-w-0 flex-wrap items-center gap-1', toolbarState.placement === 'overflow' && 'justify-start')}>
		<WorkbenchToolbarStatus
			placement={toolbarState.placement}
			label={`${avatars.length} avatars`}
			title={`${avatars.length} visible avatars`}
		/>
		<WorkbenchToolbarStatus
			placement={toolbarState.placement}
			label={`${availableCount} ready`}
			title={`${availableCount} avatars expose NoteSystem capability`}
			tone={availableCount > 0 ? 'positive' : 'neutral'}
		/>
	</div>
{/snippet}

{#snippet notesOverviewToolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchToolbarAction
		placement={toolbarState.placement}
		label="Refresh notes overview"
		title="Refresh notes overview"
		inlineTone="neutral"
		disabled={loadingCatalogs}
		onclick={() => void loadCatalogSummaries()}
	>
		<RefreshCwIcon class={cn('size-4', loadingCatalogs && 'animate-spin')} />
	</WorkbenchToolbarAction>
{/snippet}

<WorkbenchPageToolbar>
	<WorkbenchToolbar
		identityLeading={notesOverviewToolbarIdentityLeading}
		identityTitle={notesOverviewToolbarIdentityTitle}
		identitySubtitle={notesOverviewToolbarIdentitySubtitle}
		status={notesOverviewToolbarStatus}
		actions={notesOverviewToolbarActions}
		overflowLabel="Open Notes overview toolbar details"
	/>
</WorkbenchPageToolbar>

<div class="h-full min-w-0" data-testid="notes-overview">
	<WorkbenchPageContent
		class="h-full min-w-0"
		detailLayout="split-detail"
		bind:detailCompact
		bind:detailOpen
		mainClass="h-full"
		drawerClass="h-full"
		detailRatioPersistence="notes:overview:detail"
		detailLeftMin={280}
		detailRightMin={360}
		detailDefaultRatio={0.38}
	>
		{#snippet main()}
			<div class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)]">
				<div class="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-3.5 md:px-5">
					<div class="grid gap-1">
						<div class="flex items-center gap-2">
							<NotebookTextIcon class="size-5 text-muted-foreground" />
							<h2 class="text-sm font-semibold">Avatar notes</h2>
						</div>
						<p class="max-w-3xl text-sm leading-6 text-muted-foreground">
							Each Notes tab focuses one avatar. Workspace and source roots appear only inside that avatar scope.
						</p>
					</div>
					{#if detailCompact && selectedEntry}
						<Button variant="outline" size="sm" onclick={() => (detailOpen = true)}>
							<PanelRightOpenIcon class="size-4" />
							Open detail
						</Button>
					{/if}
				</div>

				<ScrollView class="h-full" contentClass="grid gap-0 border-y border-border/50">
					{#if catalogError}
						<div class="px-4 py-6">
							<NoticeBanner tone="warning" message={catalogError} />
						</div>
					{:else if avatars.length === 0}
						<div class="px-4 py-6">
							<NoticeBanner tone="info" message="No avatars are visible yet." />
						</div>
					{:else}
						{#each avatars as entry (entry.nickname)}
							{@const catalog = catalogsByAvatar[entry.nickname] ?? null}
							{@const isSelected = selectedEntry?.nickname === entry.nickname}
							<button
								type="button"
								class={cn(
									'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/45 px-3 py-3 text-left transition-colors last:border-b-0 md:px-4 md:py-3.5',
									isSelected ? 'bg-accent/45' : 'hover:bg-muted/22',
								)}
								aria-pressed={isSelected}
								onclick={() => {
									selectAvatar(entry.nickname);
								}}
							>
								<ProfileAvatar
									label={entry.displayName ?? entry.nickname}
									src={entry.iconUrl}
									class="size-9 rounded-xl border-border/65 bg-background/70"
								/>
								<div class="grid min-w-0 gap-0.5">
									<div class="truncate text-sm font-semibold">{entry.displayName ?? entry.nickname}</div>
									<div class="truncate text-[11px] leading-5 text-muted-foreground">@{entry.nickname}</div>
								</div>
								<div class="flex items-center gap-2">
									{#if loadingCatalogs && !catalog}
										<Badge variant="outline">loading</Badge>
									{:else if catalog?.capability.available}
										<Badge variant="outline">{catalog.totalPages} pages</Badge>
									{:else}
										<Badge variant="secondary">no notes</Badge>
									{/if}
								</div>
							</button>
						{/each}
					{/if}
				</ScrollView>
			</div>
		{/snippet}

		{#snippet drawer()}
			<WorkbenchDetailDrawer
				title={selectedEntry ? `${selectedEntry.displayName ?? selectedEntry.nickname}` : 'Avatar preview'}
				description="Open a dedicated avatar Notes tab before browsing, searching, or querying."
			>
				{#snippet summary()}
					{#if selectedEntry}
						<div>Avatar: @{selectedEntry.nickname}</div>
						<div>NoteSystem: {selectedCatalog?.capability.available ? 'available' : 'unavailable'}</div>
						<div>Pages: {selectedCatalog?.totalPages ?? 0}</div>
					{:else}
						<div>Select one avatar to inspect its NoteSystem capability.</div>
					{/if}
				{/snippet}

				{#if !selectedEntry}
					<NoticeBanner tone="info" message="Select one avatar to inspect its NoteSystem capability." />
				{:else}
					<div class="grid gap-4">
						<div class="flex items-center justify-between gap-3">
							<div class="grid gap-1">
								<div class="text-sm font-semibold">NoteSystem scope</div>
								<div class="text-sm text-muted-foreground">
									This opens one tab for @{selectedEntry.nickname}. It will not switch roles from inside the page body.
								</div>
							</div>
							<Button size="sm" onclick={() => void openAvatar(selectedEntry.nickname)}>
								<PlusIcon class="size-4" />
								Open tab
							</Button>
						</div>

						<div class="grid gap-3 rounded-[0.95rem] border border-border/60 bg-background/70 p-3">
							<div class="flex flex-wrap items-center gap-2">
								<ProfileAvatar
									label={selectedEntry.displayName ?? selectedEntry.nickname}
									src={selectedEntry.iconUrl}
									class="size-10 rounded-xl border-border/65 bg-background/70"
								/>
								<div class="grid min-w-0 gap-0.5">
									<div class="truncate text-sm font-semibold">{selectedEntry.displayName ?? selectedEntry.nickname}</div>
									<div class="truncate text-xs text-muted-foreground">@{selectedEntry.nickname}</div>
								</div>
							</div>
							{#if selectedCatalog?.capability.available}
								<div class="grid gap-1 text-sm text-muted-foreground">
									<div>{selectedCatalog.totalPages} indexed pages</div>
									{#each selectedCatalog.capability.readableRoots as root (root)}
										<div class="break-all text-xs">{root}</div>
									{/each}
								</div>
							{:else}
								<NoticeBanner
									tone="warning"
									title="No NoteSystem capability"
									message="This avatar does not expose a readable AVATAR_HOME for notes."
								/>
							{/if}
						</div>
					</div>
				{/if}
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
</div>
