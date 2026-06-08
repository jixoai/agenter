<script lang="ts">
	import { goto } from '$app/navigation';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	import type {
		NoteListSort,
		NoteNotebookListOutput,
		NotePageListOutput,
		NotePageOutput,
		NoteSearchOutput,
		NoteSectionListOutput,
		NoteSqlQueryOutput,
		NoteTagsOutput,
	} from '@agenter/client-sdk';
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
		firstNoteNotebookName,
		firstNotePageListIdentity,
		firstNoteSectionName,
		hasNoteCapability,
		mapNoteSearchRows,
		mapNoteSqlResultItems,
		sameNotePageIdentity,
		type NotePageIdentity,
	} from './notes-state';
	import { parseNotesSearchSyntax } from './notes-search-syntax';
	import { buildNotesAvatarHref, type NotesMode } from './notes-workbench-location';

	let {
		avatarNickname,
		mode = 'browse',
	}: {
		avatarNickname: string;
		mode?: NotesMode;
	} = $props();

	const controller = getAppControllerContext();
	const defaultNoteSqlQuery = 'select notebook, section, page, mime, updatedAt from note_pages_view order by updatedAt desc';
	const browsePageLimit = 100;
	let notebooksOutput = $state<NoteNotebookListOutput | null>(null);
	let sectionsOutput = $state<NoteSectionListOutput | null>(null);
	let pagesOutput = $state<NotePageListOutput | null>(null);
	let selectedNotebook = $state<string | null>(null);
	let selectedSection = $state<string | null>(null);
	let selectedPage = $state<NotePageIdentity | null>(null);
	let notebookSort = $state<NoteListSort>('none');
	let sectionSort = $state<NoteListSort>('none');
	let pageSort = $state<NoteListSort>('none');
	let pageOutput = $state<NotePageOutput | null>(null);
	let searchOutput = $state<NoteSearchOutput | null>(null);
	let tagsOutput = $state<NoteTagsOutput | null>(null);
	let sqlOutput = $state<NoteSqlQueryOutput | null>(null);
	let searchQuery = $state('');
	let sqlQuery = $state(defaultNoteSqlQuery);
	let loadingNotebooks = $state(false);
	let loadingSections = $state(false);
	let loadingPages = $state(false);
	let loadingPage = $state(false);
	let searching = $state(false);
	let loadingTags = $state(false);
	let runningSql = $state(false);
	let error = $state<string | null>(null);
	let detailOpen = $state(false);
	let detailCompact = $state(false);
	let notebooksRequestSeq = 0;
	let sectionsRequestSeq = 0;
	let pagesRequestSeq = 0;
	let pageRequestSeq = 0;
	let searchRequestSeq = 0;
	let sqlAutoRunKey = '';
	let sqlAutoSelectKey = '';

	const avatars = $derived(controller.runtimeState.globalAvatarCatalog.data);
	const avatarEntry = $derived(avatars.find((avatar) => avatar.nickname === avatarNickname) ?? null);
	const avatarLabel = $derived(avatarEntry?.displayName ?? avatarNickname);
	const searchRows = $derived(mapNoteSearchRows(searchOutput?.results ?? []));
	const sqlResultItems = $derived(mapNoteSqlResultItems(sqlOutput));
	const tagRows = $derived(tagsOutput?.tags ?? []);
	const capabilityAvailable = $derived(hasNoteCapability(notebooksOutput));
	const loadingBrowse = $derived(loadingNotebooks || loadingSections || loadingPages);
	const selectedPageKey = $derived(selectedPage ? createNotePageKey(selectedPage) : '');
	const detailPending = $derived((mode === 'search' && searching) || (mode === 'query' && runningSql));
	const sourceRootSummary = $derived.by(() => {
		const roots = notebooksOutput?.capability.readableRoots ?? [];
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
			badgeLabel: notebooksOutput && notebooksOutput.totalPages > 0 ? `${notebooksOutput.totalPages}` : undefined,
		},
		{
			value: 'search',
			label: 'Search',
			title: 'Search notes and tags inside this avatar',
			badgeLabel: searchOutput && searchRows.length > 0 ? `${searchRows.length}` : undefined,
		},
		{
			value: 'query',
			label: 'Query',
			title: 'Run read-only SQL inside this avatar',
			badgeLabel: sqlOutput && sqlOutput.rows.length > 0 ? `${sqlOutput.rows.length}` : undefined,
		},
	] satisfies WorkbenchPageTabItem[]);

	const mergeByKey = <Item,>(current: readonly Item[], incoming: readonly Item[], keyOf: (item: Item) => string): Item[] => {
		const byKey = new Map(current.map((item) => [keyOf(item), item] as const));
		for (const item of incoming) {
			byKey.set(keyOf(item), item);
		}
		return [...byKey.values()];
	};

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

	const loadNotebooks = async (input: { cursor?: string; append?: boolean } = {}): Promise<void> => {
		const requestSeq = ++notebooksRequestSeq;
		loadingNotebooks = true;
		error = null;
		try {
			const output = await controller.runtimeStore.listNoteNotebooks({
				avatarNickname,
				cursor: input.cursor,
				limit: browsePageLimit,
				sort: notebookSort,
			});
			if (requestSeq !== notebooksRequestSeq) {
				return;
			}
			const nextNotebooksOutput =
				input.append && notebooksOutput
					? {
							...output,
							notebooks: mergeByKey(notebooksOutput.notebooks, output.notebooks, (notebook) => notebook.notebook),
						}
					: output;
			notebooksOutput = nextNotebooksOutput;
			const visibleNotebooks = nextNotebooksOutput.notebooks;
			const currentNotebookStillVisible = selectedNotebook
				? visibleNotebooks.some((notebook) => notebook.notebook === selectedNotebook)
				: false;
			if (!currentNotebookStillVisible) {
				selectedNotebook = firstNoteNotebookName(nextNotebooksOutput);
				selectedSection = null;
				selectedPage = null;
			}
			if (!output.capability.available) {
				sectionsOutput = null;
				pagesOutput = null;
				pageOutput = null;
				searchOutput = null;
				tagsOutput = null;
				sqlOutput = null;
			} else {
				void loadTags();
			}
		} catch (caught) {
			if (requestSeq === notebooksRequestSeq) {
				error = caught instanceof Error ? caught.message : 'Failed to load notes.';
				notebooksOutput = null;
				sectionsOutput = null;
				pagesOutput = null;
			}
		} finally {
			if (requestSeq === notebooksRequestSeq) {
				loadingNotebooks = false;
			}
		}
	};

	const loadSections = async (notebook: string, input: { cursor?: string; append?: boolean } = {}): Promise<void> => {
		const requestSeq = ++sectionsRequestSeq;
		loadingSections = true;
		error = null;
		try {
			const output = await controller.runtimeStore.listNoteSections({
				avatarNickname,
				notebook,
				cursor: input.cursor,
				limit: browsePageLimit,
				sort: sectionSort,
			});
			if (requestSeq !== sectionsRequestSeq || selectedNotebook !== notebook) {
				return;
			}
			const nextSectionsOutput =
				input.append && sectionsOutput?.notebook === notebook
					? {
							...output,
							sections: mergeByKey(sectionsOutput.sections, output.sections, (section) => section.section),
						}
					: output;
			sectionsOutput = nextSectionsOutput;
			const currentSectionStillVisible = selectedSection
				? nextSectionsOutput.sections.some((section) => section.section === selectedSection)
				: false;
			if (!currentSectionStillVisible) {
				selectedSection = firstNoteSectionName(nextSectionsOutput);
				selectedPage = null;
			}
		} catch (caught) {
			if (requestSeq === sectionsRequestSeq) {
				error = caught instanceof Error ? caught.message : 'Failed to load note sections.';
				sectionsOutput = null;
				pagesOutput = null;
			}
		} finally {
			if (requestSeq === sectionsRequestSeq) {
				loadingSections = false;
			}
		}
	};

	const loadSectionPages = async (
		notebook: string,
		section: string,
		input: { cursor?: string; append?: boolean } = {},
	): Promise<void> => {
		const requestSeq = ++pagesRequestSeq;
		loadingPages = true;
		error = null;
		try {
			const output = await controller.runtimeStore.listNoteSectionPages({
				avatarNickname,
				notebook,
				section,
				cursor: input.cursor,
				limit: browsePageLimit,
				sort: pageSort,
			});
			if (requestSeq !== pagesRequestSeq || selectedNotebook !== notebook || selectedSection !== section) {
				return;
			}
			const nextPagesOutput =
				input.append && pagesOutput?.notebook === notebook && pagesOutput.section === section
					? {
							...output,
							pages: mergeByKey(pagesOutput.pages, output.pages, createNotePageKey),
						}
					: output;
			pagesOutput = nextPagesOutput;
			const currentPageStillVisible =
				selectedPage && nextPagesOutput.pages.some((row) => sameNotePageIdentity(row, selectedPage));
			if (!currentPageStillVisible) {
				selectedPage = mode === 'browse' ? firstNotePageListIdentity(nextPagesOutput) : null;
				detailOpen = Boolean(selectedPage);
			}
		} catch (caught) {
			if (requestSeq === pagesRequestSeq) {
				error = caught instanceof Error ? caught.message : 'Failed to load note pages.';
				pagesOutput = null;
			}
		} finally {
			if (requestSeq === pagesRequestSeq) {
				loadingPages = false;
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
		const parsed = parseNotesSearchSyntax(searchQuery);
		if ((!parsed.query && parsed.tags.length === 0) || !capabilityAvailable) {
			searchOutput = null;
			return;
		}
		const requestSeq = ++searchRequestSeq;
		searching = true;
		error = null;
		try {
			const output = await controller.runtimeStore.searchNotes({
				avatarNickname,
				query: parsed.query,
				tags: parsed.tags,
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

	const selectNotebook = (notebook: string): void => {
		if (selectedNotebook === notebook) {
			return;
		}
		selectedNotebook = notebook;
		selectedSection = null;
		selectedPage = null;
		sectionsOutput = null;
		pagesOutput = null;
	};

	const selectSection = (section: string): void => {
		if (selectedSection === section) {
			return;
		}
		selectedSection = section;
		selectedPage = null;
		pagesOutput = null;
	};

	const changeNotebookSort = (sort: NoteListSort): void => {
		if (notebookSort === sort) {
			return;
		}
		notebookSort = sort;
		notebooksOutput = null;
		sectionsOutput = null;
		pagesOutput = null;
		selectedNotebook = null;
		selectedSection = null;
		selectedPage = null;
		pageOutput = null;
		void loadNotebooks();
	};

	const changeSectionSort = (sort: NoteListSort): void => {
		if (sectionSort === sort) {
			return;
		}
		sectionSort = sort;
		sectionsOutput = null;
		pagesOutput = null;
		selectedSection = null;
		selectedPage = null;
		pageOutput = null;
		if (selectedNotebook) {
			void loadSections(selectedNotebook);
		}
	};

	const changePageSort = (sort: NoteListSort): void => {
		if (pageSort === sort) {
			return;
		}
		pageSort = sort;
		pagesOutput = null;
		selectedPage = null;
		pageOutput = null;
		if (selectedNotebook && selectedSection) {
			void loadSectionPages(selectedNotebook, selectedSection);
		}
	};

	const refreshBrowse = (): void => {
		void loadNotebooks();
		if (selectedNotebook) {
			void loadSections(selectedNotebook);
		}
		if (selectedNotebook && selectedSection) {
			void loadSectionPages(selectedNotebook, selectedSection);
		}
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
		notebooksOutput = null;
		sectionsOutput = null;
		pagesOutput = null;
		selectedNotebook = null;
		selectedSection = null;
		selectedPage = null;
		pageOutput = null;
		void loadNotebooks();
	});

	$effect(() => {
		const notebook = selectedNotebook;
		if (!notebook || !capabilityAvailable) {
			sectionsOutput = null;
			pagesOutput = null;
			return;
		}
		void loadSections(notebook);
	});

	$effect(() => {
		const notebook = selectedNotebook;
		const section = selectedSection;
		if (!notebook || !section || !capabilityAvailable) {
			pagesOutput = null;
			return;
		}
		void loadSectionPages(notebook, section);
	});

	$effect(() => {
		const identity = selectedPage;
		if (!identity || !capabilityAvailable) {
			pageOutput = null;
			return;
		}
		void loadPage(identity);
	});

	$effect(() => {
		if (mode !== 'query') {
			return;
		}
		detailOpen = true;
	});

	$effect(() => {
		if (
			mode !== 'query' ||
			!capabilityAvailable ||
			runningSql ||
			sqlOutput ||
			sqlQuery.trim() !== defaultNoteSqlQuery
		) {
			return;
		}
		const key = `${avatarNickname}:${defaultNoteSqlQuery}`;
		if (sqlAutoRunKey === key) {
			return;
		}
		sqlAutoRunKey = key;
		void runSql();
	});

	$effect(() => {
		if (mode !== 'query' || !sqlOutput) {
			return;
		}
		const firstIdentity = sqlResultItems.find((item) => item.identity)?.identity ?? null;
		const key = `${avatarNickname}:${sqlQuery.trim()}:${sqlOutput.rows.length}:${firstIdentity ? createNotePageKey(firstIdentity) : 'empty'}`;
		if (sqlAutoSelectKey === key) {
			return;
		}
		sqlAutoSelectKey = key;
		selectedPage = firstIdentity;
		detailOpen = true;
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
			label={`${notebooksOutput?.totalPages ?? 0} pages`}
			title={`${notebooksOutput?.totalPages ?? 0} indexed pages`}
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
			disabled={loadingBrowse}
			onclick={refreshBrowse}
		>
			<RefreshCwIcon class={cn('size-4', loadingBrowse && 'animate-spin')} />
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
	mainClass="h-full"
	drawerClass="h-full"
	detailRatioPersistence={`notes:avatar:${avatarNickname}:detail`}
	detailLeftMin={560}
	detailRightMin={360}
	detailDefaultRatio={0.66}
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
				onSelectPage={selectPage}
			/>
		{:else if mode === 'query'}
			<NotesQueryMode
				{capabilityAvailable}
				bind:sqlQuery
				{sqlOutput}
				{runningSql}
				{selectedPageKey}
				onRunSql={runSql}
				onSelectPage={selectPage}
			/>
		{:else}
			<NotesBrowseMode
				{notebooksOutput}
				{sectionsOutput}
				{pagesOutput}
				{capabilityAvailable}
				{loadingNotebooks}
				{loadingSections}
				{loadingPages}
				{error}
				{selectedNotebook}
				{selectedSection}
				{selectedPageKey}
				{notebookSort}
				{sectionSort}
				{pageSort}
				onSelectNotebook={selectNotebook}
				onSelectSection={selectSection}
				onSelectPage={selectPage}
				onNotebookSortChange={changeNotebookSort}
				onSectionSortChange={changeSectionSort}
				onPageSortChange={changePageSort}
				onLoadMoreNotebooks={() => void loadNotebooks({ cursor: notebooksOutput?.nextCursor ?? undefined, append: true })}
				onLoadMoreSections={() =>
					selectedNotebook
						? void loadSections(selectedNotebook, { cursor: sectionsOutput?.nextCursor ?? undefined, append: true })
						: undefined}
				onLoadMorePages={() =>
					selectedNotebook && selectedSection
						? void loadSectionPages(selectedNotebook, selectedSection, {
								cursor: pagesOutput?.nextCursor ?? undefined,
								append: true,
							})
						: undefined}
			/>
		{/if}
	{/snippet}

	{#snippet drawer()}
		<NotesPageDetailDrawer
			{selectedPage}
			{pageOutput}
			{loadingPage}
			pendingDetail={detailPending}
			{mode}
			avatarLabel={avatarLabel}
			{avatarNickname}
		/>
	{/snippet}
</WorkbenchPageContent>
