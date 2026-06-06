<script lang="ts">
	import { goto } from '$app/navigation';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	import type { NoteCatalogOutput, NotePageOutput, NoteSearchOutput, NoteSqlQueryOutput, NoteTagsOutput } from '@agenter/client-sdk';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchPageTabs from '$lib/features/navigation/workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from '$lib/features/navigation/workbench-page-tabs.types';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbarStatus from '$lib/features/navigation/workbench-toolbar-status.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import { cn } from '$lib/utils.js';
	import NotesBrowseMode from './notes-browse-mode.svelte';
	import NotesPageDetailDrawer from './notes-page-detail-drawer.svelte';
	import NotesQueryMode from './notes-query-mode.svelte';
	import NotesSearchMode from './notes-search-mode.svelte';
	import {
		createNotePageKey,
		firstNotePageIdentity,
		flattenNoteCatalog,
		hasNoteCapability,
		mapNoteSearchRows,
		sameNotePageIdentity,
		type NotePageIdentity,
	} from './notes-state';
	import { buildNotesAvatarHref, type NotesMode } from './notes-workbench-location';

	let {
		avatarNickname,
		mode = 'browse',
	}: {
		avatarNickname: string;
		mode?: NotesMode;
	} = $props();

	const controller = getAppControllerContext();
	let catalog = $state<NoteCatalogOutput | null>(null);
	let selectedPage = $state<NotePageIdentity | null>(null);
	let pageOutput = $state<NotePageOutput | null>(null);
	let searchOutput = $state<NoteSearchOutput | null>(null);
	let tagsOutput = $state<NoteTagsOutput | null>(null);
	let sqlOutput = $state<NoteSqlQueryOutput | null>(null);
	let searchQuery = $state('');
	let sqlQuery = $state('select notebook, section, page, mime, updatedAt from note_pages_view order by updatedAt desc');
	let loadingCatalog = $state(false);
	let loadingPage = $state(false);
	let searching = $state(false);
	let loadingTags = $state(false);
	let runningSql = $state(false);
	let error = $state<string | null>(null);
	let detailOpen = $state(true);
	let detailCompact = $state(false);
	let catalogRequestSeq = 0;
	let pageRequestSeq = 0;
	let searchRequestSeq = 0;

	const avatars = $derived(controller.runtimeState.globalAvatarCatalog.data);
	const avatarEntry = $derived(avatars.find((avatar) => avatar.nickname === avatarNickname) ?? null);
	const avatarLabel = $derived(avatarEntry?.displayName ?? avatarNickname);
	const searchRows = $derived(mapNoteSearchRows(searchOutput?.results ?? []));
	const tagRows = $derived(tagsOutput?.tags ?? []);
	const capabilityAvailable = $derived(hasNoteCapability(catalog));
	const selectedPageKey = $derived(selectedPage ? createNotePageKey(selectedPage) : '');
	const sourceRootSummary = $derived.by(() => {
		const roots = catalog?.capability.readableRoots ?? [];
		if (roots.length === 0) {
			return 'No readable NoteSystem roots';
		}
		if (roots.length === 1) {
			return roots[0] ?? 'One readable NoteSystem root';
		}
		return `${roots.length} readable NoteSystem roots`;
	});
	const pageTabs = $derived([
		{
			value: 'browse',
			label: 'Browse',
			title: 'Browse notebook, section, and page hierarchy',
			badgeLabel: catalog ? `${catalog.totalPages}` : undefined,
		},
		{
			value: 'search',
			label: 'Search',
			title: 'Search notes and tags inside this avatar',
			badgeLabel: searchOutput ? `${searchRows.length}` : undefined,
		},
		{
			value: 'query',
			label: 'Query',
			title: 'Run read-only SQL inside this avatar',
			badgeLabel: sqlOutput ? `${sqlOutput.rows.length}` : undefined,
		},
	] satisfies WorkbenchPageTabItem[]);

	const loadTags = async (): Promise<void> => {
		if (!capabilityAvailable) {
			tagsOutput = null;
			return;
		}
		loadingTags = true;
		try {
			tagsOutput = await controller.runtimeStore.listNoteTags({
				avatarNickname,
			});
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Failed to load note tags.';
			tagsOutput = null;
		} finally {
			loadingTags = false;
		}
	};

	const loadCatalog = async (): Promise<void> => {
		const requestSeq = ++catalogRequestSeq;
		loadingCatalog = true;
		error = null;
		try {
			const output = await controller.runtimeStore.listNoteCatalog({
				avatarNickname,
				limit: 500,
			});
			if (requestSeq !== catalogRequestSeq) {
				return;
			}
			catalog = output;
			const currentStillVisible =
				selectedPage && flattenNoteCatalog(output).some((row) => sameNotePageIdentity(row, selectedPage));
			if (!currentStillVisible) {
				selectedPage = firstNotePageIdentity(output);
			}
			if (!output.capability.available) {
				pageOutput = null;
				searchOutput = null;
				tagsOutput = null;
				sqlOutput = null;
			} else {
				void loadTags();
			}
		} catch (caught) {
			if (requestSeq === catalogRequestSeq) {
				error = caught instanceof Error ? caught.message : 'Failed to load notes.';
				catalog = null;
			}
		} finally {
			if (requestSeq === catalogRequestSeq) {
				loadingCatalog = false;
			}
		}
	};

	const loadPage = async (identity: NotePageIdentity): Promise<void> => {
		const requestSeq = ++pageRequestSeq;
		loadingPage = true;
		try {
			const output = await controller.runtimeStore.readNotePage({
				avatarNickname,
				...identity,
			});
			if (requestSeq === pageRequestSeq) {
				pageOutput = output;
			}
		} catch (caught) {
			if (requestSeq === pageRequestSeq) {
				error = caught instanceof Error ? caught.message : 'Failed to load note page.';
				pageOutput = null;
			}
		} finally {
			if (requestSeq === pageRequestSeq) {
				loadingPage = false;
			}
		}
	};

	const runSearch = async (): Promise<void> => {
		const query = searchQuery.trim();
		if (!query || !capabilityAvailable) {
			searchOutput = null;
			return;
		}
		const requestSeq = ++searchRequestSeq;
		searching = true;
		error = null;
		try {
			const output = await controller.runtimeStore.searchNotes({
				avatarNickname,
				query,
				limit: 50,
			});
			if (requestSeq === searchRequestSeq) {
				searchOutput = output;
			}
		} catch (caught) {
			if (requestSeq === searchRequestSeq) {
				error = caught instanceof Error ? caught.message : 'Failed to search notes.';
				searchOutput = null;
			}
		} finally {
			if (requestSeq === searchRequestSeq) {
				searching = false;
			}
		}
	};

	const filterTag = async (tagName: string): Promise<void> => {
		if (!capabilityAvailable) {
			searchOutput = null;
			return;
		}
		const requestSeq = ++searchRequestSeq;
		searching = true;
		searchQuery = '';
		error = null;
		try {
			const output = await controller.runtimeStore.searchNotes({
				avatarNickname,
				query: '',
				tags: [tagName],
				limit: 50,
			});
			if (requestSeq === searchRequestSeq) {
				searchOutput = output;
			}
		} catch (caught) {
			if (requestSeq === searchRequestSeq) {
				error = caught instanceof Error ? caught.message : 'Failed to filter notes by tag.';
			}
		} finally {
			if (requestSeq === searchRequestSeq) {
				searching = false;
			}
		}
	};

	const runSql = async (): Promise<void> => {
		const sql = sqlQuery.trim();
		if (!sql || !capabilityAvailable) {
			sqlOutput = null;
			return;
		}
		runningSql = true;
		error = null;
		try {
			sqlOutput = await controller.runtimeStore.queryNotes({
				avatarNickname,
				sql,
				limit: 25,
			});
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Failed to query notes.';
			sqlOutput = null;
		} finally {
			runningSql = false;
		}
	};

	const selectPage = (identity: NotePageIdentity): void => {
		selectedPage = identity;
		detailOpen = true;
	};

	const handleModeChange = async (value: string): Promise<void> => {
		await goto(buildNotesAvatarHref(avatarNickname, value as NotesMode), {
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
		avatarNickname;
		void loadCatalog();
	});

	$effect(() => {
		const identity = selectedPage;
		if (!identity || !capabilityAvailable) {
			pageOutput = null;
			return;
		}
		void loadPage(identity);
	});
</script>

{#snippet notesToolbarPageTabs(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchPageTabs
		ariaLabel="Notes modes"
		value={mode}
		items={pageTabs}
		{toolbarState}
		onValueChange={handleModeChange}
	/>
{/snippet}

{#snippet notesToolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<ProfileAvatar
		label={avatarLabel}
		src={avatarEntry?.iconUrl ?? null}
		class="size-6 rounded-md border-border/65 bg-background/70"
	/>
{/snippet}

{#snippet notesToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">@{avatarNickname}</span>
{/snippet}

{#snippet notesToolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">{sourceRootSummary}</span>
{/snippet}

{#snippet notesToolbarStatus(toolbarState: WorkbenchToolbarRenderState)}
	<div class={cn('flex min-w-0 flex-wrap items-center gap-1', toolbarState.placement === 'overflow' && 'justify-start')}>
		<WorkbenchToolbarStatus
			placement={toolbarState.placement}
			label={`${catalog?.totalPages ?? 0} pages`}
			title={`${catalog?.totalPages ?? 0} indexed pages`}
			tone={capabilityAvailable ? 'positive' : 'neutral'}
		/>
		<WorkbenchToolbarStatus
			placement={toolbarState.placement}
			label={`${tagRows.length} tags`}
			title={`${tagRows.length} tags`}
		/>
	</div>
{/snippet}

{#snippet notesToolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<div class={cn('flex min-w-0 items-center gap-1', toolbarState.placement === 'overflow' && 'grid gap-2')}>
		<WorkbenchToolbarAction
			placement={toolbarState.placement}
			label="Refresh notes"
			title="Refresh notes"
			inlineTone="neutral"
			disabled={loadingCatalog}
			onclick={() => void loadCatalog()}
		>
			<RefreshCwIcon class={cn('size-4', loadingCatalog && 'animate-spin')} />
		</WorkbenchToolbarAction>
	</div>
{/snippet}

<WorkbenchPageToolbar>
	<WorkbenchToolbar
		pageTabs={notesToolbarPageTabs}
		identityLeading={notesToolbarIdentityLeading}
		identityTitle={notesToolbarIdentityTitle}
		identitySubtitle={notesToolbarIdentitySubtitle}
		status={notesToolbarStatus}
		actions={notesToolbarActions}
		overflowLabel="Open Notes toolbar details"
	/>
</WorkbenchPageToolbar>

<WorkbenchPageContent
	class="h-full"
	detailLayout="split-detail"
	bind:detailCompact
	bind:detailOpen
	detailRatioPersistence={`notes:avatar:${avatarNickname}:detail`}
	data-testid="notes-avatar-route"
>
	{#snippet main()}
		{#if mode === 'search'}
			<NotesSearchMode
				{capabilityAvailable}
				bind:searchQuery
				{searchOutput}
				{searchRows}
				{tagRows}
				{loadingTags}
				{searching}
				{selectedPageKey}
				onRunSearch={runSearch}
				onFilterTag={filterTag}
				onSelectPage={selectPage}
			/>
		{:else if mode === 'query'}
			<NotesQueryMode
				{capabilityAvailable}
				bind:sqlQuery
				{sqlOutput}
				{runningSql}
				onRunSql={runSql}
			/>
		{:else}
			<NotesBrowseMode
				{catalog}
				{capabilityAvailable}
				{loadingCatalog}
				{error}
				{selectedPageKey}
				onSelectPage={selectPage}
			/>
		{/if}
	{/snippet}

	{#snippet drawer()}
		<NotesPageDetailDrawer
			{selectedPage}
			{pageOutput}
			{loadingPage}
			avatarLabel={avatarLabel}
			{avatarNickname}
		/>
	{/snippet}
</WorkbenchPageContent>
