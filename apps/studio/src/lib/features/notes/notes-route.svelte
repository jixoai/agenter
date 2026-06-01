<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import LinkIcon from '@lucide/svelte/icons/link';
	import NotebookTextIcon from '@lucide/svelte/icons/notebook-text';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SearchIcon from '@lucide/svelte/icons/search';
	import TagsIcon from '@lucide/svelte/icons/tags';
	import { page } from '$app/state';

	import type { NoteCatalogOutput, NotePageOutput, NoteSearchOutput, NoteSqlQueryOutput, NoteTagsOutput } from '@agenter/client-sdk';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import { cn } from '$lib/utils.js';
	import {
		createNotePageKey,
		firstNotePageIdentity,
		flattenNoteCatalog,
		hasNoteCapability,
		mapNoteSearchRows,
		sameNotePageIdentity,
		type NotePageIdentity,
	} from './notes-state';

	const controller = getAppControllerContext();
	let selectedAvatar = $state(page.url.searchParams.get('avatar') ?? '');
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
	const searchRows = $derived(mapNoteSearchRows(searchOutput?.results ?? []));
	const tagRows = $derived(tagsOutput?.tags ?? []);
	const capabilityAvailable = $derived(hasNoteCapability(catalog));
	const selectedPageKey = $derived(selectedPage ? createNotePageKey(selectedPage) : '');
	const selectedPageFact = $derived(pageOutput?.page ?? null);
	const avatarLabel = $derived(
		selectedAvatar ||
			catalog?.avatar.nickname ||
			avatars.find((avatar) => avatar.defaultAvatar)?.nickname ||
			avatars[0]?.nickname ||
			'default',
	);
	const tabs = $derived([
		{
			id: 'notes',
			label: 'Notes',
			href: '/notes',
			title: 'Notes',
			description: 'Read and search avatar-private NoteSystem pages.',
			icon: NotebookTextIcon,
			badgeLabel: catalog ? `${catalog.totalPages}` : undefined,
		},
	]);

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalAvatarCatalog();
		void controller.runtimeStore.hydrateGlobalAvatarCatalog();
		return () => {
			release();
		};
	});

	const formatTimestamp = (value: string | null | undefined): string => {
		if (!value) {
			return 'Unknown';
		}
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
	};

	const loadCatalog = async (): Promise<void> => {
		const requestSeq = ++catalogRequestSeq;
		loadingCatalog = true;
		error = null;
		try {
			const output = await controller.runtimeStore.listNoteCatalog({
				avatarNickname: selectedAvatar || undefined,
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

	const loadTags = async (): Promise<void> => {
		if (!capabilityAvailable) {
			tagsOutput = null;
			return;
		}
		loadingTags = true;
		try {
			tagsOutput = await controller.runtimeStore.listNoteTags({
				avatarNickname: selectedAvatar || undefined,
			});
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Failed to load note tags.';
			tagsOutput = null;
		} finally {
			loadingTags = false;
		}
	};

	const loadPage = async (identity: NotePageIdentity): Promise<void> => {
		const requestSeq = ++pageRequestSeq;
		loadingPage = true;
		try {
			const output = await controller.runtimeStore.readNotePage({
				avatarNickname: selectedAvatar || undefined,
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
				avatarNickname: selectedAvatar || undefined,
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
				avatarNickname: selectedAvatar || undefined,
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

	$effect(() => {
		selectedAvatar;
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

<WorkbenchWindow ariaLabel="Notes workbench tabs" value="notes" {tabs} bodyMode="fill">
	<WorkbenchPageContent
		class="h-full"
		detailLayout="split-detail"
		bind:detailCompact
		bind:detailOpen
		detailRatioPersistence="notes:detail"
		data-testid="notes-workbench"
	>
		{#snippet main()}
			<WorkbenchScaffold tone="page" bodyClass="h-full" data-testid="notes-main">
				{#snippet header()}
					<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
						<div class="grid gap-1">
							<h1 class="text-sm font-semibold text-foreground">NoteSystem</h1>
							<p class="text-sm text-muted-foreground">
								Browse raw avatar-private notes by notebook, section, and page.
							</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<label class="grid gap-1 text-xs text-muted-foreground">
								<span>Avatar</span>
								<select
									class="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs"
									aria-label="Notes avatar"
									bind:value={selectedAvatar}
								>
									<option value="">Default avatar</option>
									{#each avatars as avatar (avatar.nickname)}
										<option value={avatar.nickname}>{avatar.displayName ?? avatar.nickname}</option>
									{/each}
								</select>
							</label>
							<Button variant="outline" size="sm" onclick={() => void loadCatalog()} disabled={loadingCatalog}>
								<RefreshCwIcon class={cn('size-4', loadingCatalog && 'animate-spin')} />
								Refresh
							</Button>
						</div>
					</div>
				{/snippet}

				<div class="grid h-full gap-3 p-3 md:grid-cols-[minmax(13rem,0.72fr)_minmax(0,1fr)] md:p-4">
					<section class="grid h-full gap-3" aria-label="Note notebooks">
						{#if error}
							<NoticeBanner tone="destructive" title="Notes unavailable" message={error} />
						{:else if loadingCatalog && !catalog}
							<NoticeBanner tone="info" message="Loading NoteSystem catalog." />
						{:else if catalog && !capabilityAvailable}
							<NoticeBanner
								tone="warning"
								title="No NoteSystem capability"
								message="The selected avatar does not expose a readable AVATAR_HOME for notes."
							/>
						{:else if catalog && catalog.totalPages === 0}
							<NoticeBanner tone="info" title="No notes yet" message="Use the note CLI to record raw notes first." />
						{:else}
							<div class="flex items-center justify-between gap-2 px-1">
								<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notebooks</div>
								<Badge variant="outline">{catalog?.totalPages ?? 0} pages</Badge>
							</div>
						{/if}

						{#if capabilityAvailable}
							<div class="grid gap-2 rounded-lg border border-border/60 bg-background/55 p-2" aria-label="Note tags">
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
										<TagsIcon class={cn('size-3.5', loadingTags && 'animate-pulse')} />
										<span>Tags</span>
									</div>
									<Badge variant="outline">{tagRows.length}</Badge>
								</div>
								<div class="flex flex-wrap gap-1">
									{#each tagRows as tag (tag.id)}
										<Button
											type="button"
											variant="outline"
											size="sm"
											class="h-7 px-2 text-xs"
											onclick={() => {
												searchQuery = '';
												void controller.runtimeStore
													.searchNotes({
														avatarNickname: selectedAvatar || undefined,
														query: '',
														tags: [tag.name],
														limit: 50,
													})
													.then((output) => {
														searchOutput = output;
													})
													.catch((caught) => {
														error = caught instanceof Error ? caught.message : 'Failed to filter notes by tag.';
													});
											}}
										>
											{tag.name}
											<span class="text-muted-foreground">{tag.count}</span>
										</Button>
									{/each}
									{#if tagRows.length === 0}
										<span class="text-xs text-muted-foreground">No tags indexed.</span>
									{/if}
								</div>
							</div>
						{/if}

						<ScrollView class="h-full" contentClass="grid gap-2 pr-2" viewportTestId="notes-catalog-scroll">
							{#each catalog?.notebooks ?? [] as notebook (notebook.notebook)}
								<div class="grid gap-2 rounded-lg border border-border/60 bg-background/50 p-2">
									<div class="flex items-center gap-2 text-sm font-semibold">
										<NotebookTextIcon class="size-4 text-muted-foreground" />
										<span class="truncate">{notebook.notebook}</span>
									</div>
									{#each notebook.sections as section (section.section)}
										<div class="grid gap-1">
											<div class="px-2 text-xs font-medium text-muted-foreground">{section.section}</div>
											{#each section.pages as notePage (createNotePageKey(notePage))}
												<button
													type="button"
													class={cn(
														'grid gap-1 rounded-md px-2 py-2 text-left text-sm transition-colors',
														selectedPageKey === createNotePageKey(notePage)
															? 'bg-accent text-accent-foreground'
															: 'hover:bg-muted/60',
													)}
													aria-pressed={selectedPageKey === createNotePageKey(notePage)}
													onclick={() => selectPage(notePage)}
												>
													<span class="truncate font-medium">{notePage.page}</span>
													<span class="line-clamp-2 text-xs text-muted-foreground">{notePage.preview || 'Empty note'}</span>
												</button>
											{/each}
										</div>
									{/each}
								</div>
							{/each}
						</ScrollView>
					</section>

					<section class="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3" aria-label="Note search results">
						<div class="grid gap-2">
							<form
								class="flex items-center gap-2"
								onsubmit={(event) => {
									event.preventDefault();
									void runSearch();
								}}
							>
								<div class="relative min-w-0 flex-1">
									<SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										class="pl-9"
										placeholder="Search notes"
										aria-label="Search notes"
										disabled={!capabilityAvailable}
										bind:value={searchQuery}
									/>
								</div>
								<Button type="submit" size="sm" disabled={!capabilityAvailable || searching || !searchQuery.trim()}>
									<SearchIcon class={cn('size-4', searching && 'animate-pulse')} />
									Search
								</Button>
							</form>
							<form
								class="grid gap-2 rounded-lg border border-border/60 bg-background/55 p-2"
								aria-label="Read-only note SQL query"
								onsubmit={(event) => {
									event.preventDefault();
									void runSql();
								}}
							>
								<div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
									<div class="flex items-center gap-2 font-medium uppercase tracking-wide">
										<DatabaseIcon class="size-3.5" />
										<span>Read-only SQL</span>
									</div>
									<Button type="submit" size="sm" variant="outline" disabled={!capabilityAvailable || runningSql || !sqlQuery.trim()}>
										<DatabaseIcon class={cn('size-4', runningSql && 'animate-pulse')} />
										Query
									</Button>
								</div>
								<Input aria-label="Note SQL query" disabled={!capabilityAvailable} bind:value={sqlQuery} />
								{#if sqlOutput}
									<div class="grid gap-1 text-xs text-muted-foreground">
										<div>{sqlOutput.rows.length} rows</div>
										<ScrollView class="max-h-36 rounded-md bg-muted/40" contentClass="p-2">
											<pre class="whitespace-pre-wrap text-[11px] leading-5 text-foreground">{JSON.stringify(sqlOutput.rows, null, 2)}</pre>
										</ScrollView>
									</div>
								{/if}
							</form>
						</div>

						<ScrollView class="h-full" contentClass="grid auto-rows-max gap-2 pr-2" viewportTestId="notes-search-scroll">
							{#if searchOutput && searchRows.length === 0}
								<NoticeBanner tone="info" message="No matching notes." />
							{/if}
							{#each searchRows as result (result.key)}
								<button
									type="button"
									class={cn(
										'grid gap-1 rounded-lg border border-border/60 bg-background/55 p-3 text-left transition-colors hover:bg-muted/50',
										selectedPageKey === result.key && 'border-primary/45 bg-accent/55',
									)}
									aria-pressed={selectedPageKey === result.key}
									onclick={() => selectPage(result)}
								>
									<div class="flex items-center justify-between gap-2">
										<div class="min-w-0 truncate text-sm font-medium">{result.notebook} / {result.section} / {result.page}</div>
										<Badge variant="outline">score {result.score.toFixed(2)}</Badge>
									</div>
									<p class="line-clamp-3 text-sm text-muted-foreground">{result.snippet}</p>
								</button>
							{/each}
							{#if !searchOutput}
								<div class="grid gap-2 rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
									<div>Search results appear here.</div>
									<div>Catalog browsing remains available without search.</div>
								</div>
							{/if}
						</ScrollView>
					</section>
				</div>
			</WorkbenchScaffold>
		{/snippet}

		{#snippet drawer()}
			<WorkbenchDetailDrawer
				title={selectedPage ? selectedPage.page : 'Selected note'}
				description={selectedPage ? `${selectedPage.notebook} / ${selectedPage.section}` : 'Select a note page.'}
				data-testid="notes-detail"
			>
				{#if !selectedPage}
					<NoticeBanner tone="info" message="Select a note page from the catalog or search results." />
				{:else if loadingPage && !selectedPageFact}
					<NoticeBanner tone="info" message="Loading note page." />
				{:else if pageOutput && !pageOutput.capability.available}
					<NoticeBanner tone="warning" message="The selected avatar has no NoteSystem capability." />
				{:else if pageOutput && !selectedPageFact}
					<NoticeBanner tone="warning" message="The selected note page was not found." />
				{:else if selectedPageFact}
					<div class="grid gap-3">
						<div class="grid gap-2 rounded-lg border border-border/60 bg-background/55 p-3 text-xs text-muted-foreground">
							<div class="flex items-center gap-2 text-sm font-semibold text-foreground">
								<FileTextIcon class="size-4" />
								<span class="truncate">{createNotePageKey(selectedPageFact.identity)}</span>
							</div>
							<div>Avatar: {avatarLabel}</div>
							<div class="truncate">Book ID: {selectedPageFact.metadata.bookId}</div>
							<div class="truncate">Section ID: {selectedPageFact.metadata.sectionId}</div>
							<div class="truncate">Page ID: {selectedPageFact.metadata.pageId}</div>
							<div>MIME: {selectedPageFact.metadata.mime}</div>
							<div>Created: {formatTimestamp(selectedPageFact.metadata.createdAt)}</div>
							<div>Updated: {formatTimestamp(selectedPageFact.metadata.updatedAt)}</div>
							{#if selectedPageFact.metadata.sourceWorkspace}
								<div class="truncate">Source: {selectedPageFact.metadata.sourceWorkspace}</div>
							{/if}
							{#if selectedPageFact.metadata.tags.length > 0}
								<div class="flex flex-wrap gap-1">
									{#each selectedPageFact.metadata.tags as tag (tag)}
										<Badge variant="outline">{tag}</Badge>
									{/each}
								</div>
							{/if}
							{#if selectedPageFact.metadata.references.length > 0}
								<div class="grid gap-1">
									<div class="flex items-center gap-1 font-medium text-foreground">
										<LinkIcon class="size-3.5" />
										<span>References</span>
									</div>
									{#each selectedPageFact.metadata.references as reference (reference.pageId)}
										<div class="truncate">
											{reference.notebook} / {reference.section} / {reference.page}
										</div>
									{/each}
								</div>
							{/if}
						</div>
						<pre class="whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 p-3 text-sm leading-6 text-foreground">{selectedPageFact.body || '(empty note)'}</pre>
					</div>
				{/if}
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
</WorkbenchWindow>
