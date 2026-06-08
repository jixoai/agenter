<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import NotebookTextIcon from '@lucide/svelte/icons/notebook-text';
	import PlusIcon from '@lucide/svelte/icons/plus';

	import type {
		NoteListSort,
		NoteNotebookListOutput,
		NoteNotebookSummary,
		NotePageListOutput,
		NotePageSummary,
		NoteSectionListOutput,
		NoteSectionSummary,
	} from '@agenter/client-sdk';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuLabel,
		DropdownMenuRadioGroup,
		DropdownMenuRadioItem,
		DropdownMenuTrigger,
	} from '$lib/components/ui/dropdown-menu/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import { cn } from '$lib/utils.js';
	import { shouldTriggerNotesScrollPaginationFromEvent } from './notes-scroll-pagination';
	import { createNotePageKey, type NotePageIdentity } from './notes-state';

	type NotesBrowseListMode = 'sections-pages' | 'notebooks';

	let {
		notebooksOutput,
		sectionsOutput,
		pagesOutput,
		capabilityAvailable,
		loadingNotebooks,
		loadingSections,
		loadingPages,
		error,
		selectedNotebook,
		selectedSection,
		selectedPageKey,
		notebookSort,
		sectionSort,
		pageSort,
		onSelectNotebook,
		onSelectSection,
		onSelectPage,
		onNotebookSortChange,
		onSectionSortChange,
		onPageSortChange,
		onLoadMoreNotebooks,
		onLoadMoreSections,
		onLoadMorePages,
	}: {
		notebooksOutput: NoteNotebookListOutput | null;
		sectionsOutput: NoteSectionListOutput | null;
		pagesOutput: NotePageListOutput | null;
		capabilityAvailable: boolean;
		loadingNotebooks: boolean;
		loadingSections: boolean;
		loadingPages: boolean;
		error: string | null;
		selectedNotebook: string | null;
		selectedSection: string | null;
		selectedPageKey: string;
		notebookSort: NoteListSort;
		sectionSort: NoteListSort;
		pageSort: NoteListSort;
		onSelectNotebook: (notebook: string) => void;
		onSelectSection: (section: string) => void;
		onSelectPage: (identity: NotePageIdentity) => void;
		onNotebookSortChange: (sort: NoteListSort) => void;
		onSectionSortChange: (sort: NoteListSort) => void;
		onPageSortChange: (sort: NoteListSort) => void;
		onLoadMoreNotebooks: () => void;
		onLoadMoreSections: () => void;
		onLoadMorePages: () => void;
	} = $props();

	let listMode = $state<NotesBrowseListMode>('sections-pages');
	const sortOptions = [
		{ value: 'none', label: '无' },
		{ value: 'alpha', label: '字母排序' },
		{ value: 'createdAt', label: '创建时间' },
		{ value: 'updatedAt', label: '修改时间' },
	] satisfies Array<{ value: NoteListSort; label: string }>;

	const notebooks = $derived(notebooksOutput?.notebooks ?? []);
	const sections = $derived(sectionsOutput?.sections ?? []);
	const pages = $derived(pagesOutput?.pages ?? []);
	const readableRoots = $derived(notebooksOutput?.capability.readableRoots ?? []);
	const selectedNotebookLabel = $derived(selectedNotebook ?? 'Notebooks');
	const listHeaderLabel = $derived(listMode === 'notebooks' ? 'Notebooks' : selectedNotebookLabel);
	const sectionsCountLabel = $derived(sectionsOutput ? ` (${sectionsOutput.totalSections})` : '');
	const pagesCountLabel = $derived(pagesOutput ? ` (${pagesOutput.totalPages})` : '');
	const sourceRootHelpText = $derived.by(() => {
		if (!notebooksOutput?.capability.available) {
			return 'Readable source roots appear after NoteSystem capability is available.';
		}
		return [
			`Notebook: ${selectedNotebookLabel}`,
			`Indexed pages: ${notebooksOutput.totalPages}`,
			'Workspace/source facts are metadata inside this avatar tab; they do not switch the tab role.',
			...readableRoots.map((root) => `- ${root}`),
		].join('\n');
	});
	const canLoadMoreNotebooks = $derived(Boolean(notebooksOutput?.nextCursor));
	const canLoadMoreSections = $derived(Boolean(sectionsOutput?.nextCursor));
	const canLoadMorePages = $derived(Boolean(pagesOutput?.nextCursor));

	const formatUpdatedAt = (value: string): string => (value ? value.replace('T', ' ').slice(0, 16) : 'unknown');

	const sortLabel = (sort: NoteListSort): string => sortOptions.find((option) => option.value === sort)?.label ?? '无';

	const toggleNotebookList = (): void => {
		listMode = listMode === 'notebooks' ? 'sections-pages' : 'notebooks';
	};

	const selectNotebookFromList = (notebook: string): void => {
		onSelectNotebook(notebook);
		listMode = 'sections-pages';
	};

	const handleNotebookScroll = (event: Event): void => {
		if (canLoadMoreNotebooks && !loadingNotebooks && shouldTriggerNotesScrollPaginationFromEvent(event)) {
			onLoadMoreNotebooks();
		}
	};

	const handleSectionScroll = (event: Event): void => {
		if (canLoadMoreSections && !loadingSections && shouldTriggerNotesScrollPaginationFromEvent(event)) {
			onLoadMoreSections();
		}
	};

	const handlePageScroll = (event: Event): void => {
		if (canLoadMorePages && !loadingPages && shouldTriggerNotesScrollPaginationFromEvent(event)) {
			onLoadMorePages();
		}
	};
</script>

{#snippet sortMenu(title: string, value: NoteListSort, onValueChange: (sort: NoteListSort) => void)}
	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<Button
					{...props}
					type="button"
					variant="ghost"
					size="icon"
					class="size-7"
					title={`${title}: ${sortLabel(value)}`}
					aria-label={`${title}: ${sortLabel(value)}`}
				>
					<ArrowUpDownIcon class="size-3.5" />
				</Button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end" sideOffset={6} class="w-40">
			<DropdownMenuLabel>{title}</DropdownMenuLabel>
			<DropdownMenuRadioGroup value={value} onValueChange={(nextValue) => onValueChange(nextValue as NoteListSort)}>
				{#each sortOptions as option (option.value)}
					<DropdownMenuRadioItem value={option.value}>{option.label}</DropdownMenuRadioItem>
				{/each}
			</DropdownMenuRadioGroup>
		</DropdownMenuContent>
	</DropdownMenu>
{/snippet}

<section
	class="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 md:p-4"
	aria-label="Notes browse"
	data-testid="notes-browse-mode"
>
	<div class="grid min-w-0 gap-3">
		{#if error}
			<NoticeBanner tone="destructive" title="Notes unavailable" message={error} />
		{:else if loadingNotebooks && !notebooksOutput}
			<NoticeBanner tone="info" message="Loading NoteSystem notebooks." />
		{:else if notebooksOutput && !capabilityAvailable}
			<NoticeBanner
				tone="warning"
				title="No NoteSystem capability"
				message="The selected avatar does not expose a readable AVATAR_HOME for notes."
			/>
		{:else if notebooksOutput && notebooksOutput.totalPages === 0}
			<NoticeBanner tone="info" title="No notes yet" message="Use the note CLI to record raw notes first." />
		{/if}
	</div>

	{#if notebooksOutput && capabilityAvailable && notebooksOutput.totalPages > 0}
		<div
			class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] rounded-lg border border-border/55 bg-background/50"
			data-testid="notes-browse-list-pane"
		>
			<header class="flex min-w-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
				<div class="inline-flex min-w-0 items-center gap-1.5">
					<button
						type="button"
						class="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm font-semibold transition-colors hover:bg-muted/45"
						aria-expanded={listMode === 'notebooks'}
						aria-controls="notes-browse-list-body"
						data-testid="notes-notebook-scope-toggle"
						onclick={toggleNotebookList}
					>
						<NotebookTextIcon class="size-4 shrink-0 text-muted-foreground" />
						<span class="truncate">
							{listHeaderLabel}{listMode === 'notebooks' ? ` (${notebooksOutput.totalNotebooks})` : ''}
						</span>
					</button>
					<HelpHint
						ariaLabel="Note source roots"
						align="start"
						side="bottom"
						textContext={sourceRootHelpText}
					>
						<div class="grid max-w-[22rem] gap-2 text-left normal-case tracking-normal">
							<div class="text-sm font-semibold text-foreground">Source roots</div>
							<p class="text-sm text-muted-foreground">
								Workspace/source facts are metadata inside this avatar tab; they do not switch the tab role.
							</p>
							<div class="grid gap-1 text-xs text-muted-foreground">
								<div>Notebook: {selectedNotebookLabel}</div>
								<div>{notebooksOutput.totalPages} indexed pages</div>
							</div>
							<div class="grid gap-1">
								{#each readableRoots as root (root)}
									<div class="break-all rounded-md border border-border/60 bg-background/75 px-2 py-1 text-xs text-foreground">
										{root}
									</div>
								{/each}
							</div>
						</div>
					</HelpHint>
					<button
						type="button"
						class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
						aria-label={listMode === 'notebooks' ? 'Show sections and pages' : 'Show notebooks list'}
						onclick={toggleNotebookList}
					>
						<ChevronDownIcon class={cn('size-4 transition-transform', listMode === 'notebooks' && 'rotate-180')} />
					</button>
				</div>
				{#if listMode === 'notebooks'}
					<div class="flex shrink-0 items-center gap-1">
						{@render sortMenu('排序笔记本', notebookSort, onNotebookSortChange)}
					</div>
				{/if}
			</header>

			<div id="notes-browse-list-body" class="min-h-0 min-w-0">
				{#if listMode === 'notebooks'}
					<div class="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]" data-testid="notes-notebooks-list">
						<ScrollView
							class="min-h-0"
							viewportTestId="notes-notebooks-scroll"
							onViewportScroll={handleNotebookScroll}
							virtual={{
								items: notebooks,
								estimateSize: () => 72,
								getItemKey: (_, notebook) => notebook.notebook,
								measureElement: true,
								overscan: 10,
								paddingStart: 8,
								paddingEnd: 8,
							}}
						>
							{#snippet empty()}
								<div class="rounded-md bg-muted/24 px-3 py-4 text-sm text-muted-foreground">No notebooks.</div>
							{/snippet}

							{#snippet item(notebook: NoteNotebookSummary)}
								<button
									type="button"
									class={cn(
										'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60',
										selectedNotebook === notebook.notebook && 'bg-accent text-accent-foreground',
									)}
									aria-pressed={selectedNotebook === notebook.notebook}
									onclick={() => selectNotebookFromList(notebook.notebook)}
								>
									<div class="grid min-w-0 gap-0.5">
										<span class="truncate font-medium">{notebook.notebook}</span>
										<span class="truncate text-xs text-muted-foreground">{formatUpdatedAt(notebook.updatedAt)}</span>
									</div>
									<div class="flex shrink-0 items-center gap-2">
										<Badge variant="outline">{notebook.sectionCount} sections</Badge>
										<Badge variant="outline">{notebook.pageCount} pages</Badge>
									</div>
								</button>
							{/snippet}

							{#snippet after()}
								{#if canLoadMoreNotebooks}
									<div class="px-2 pb-2">
										<button
											type="button"
											class="w-full rounded-md bg-muted/28 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/44"
											disabled={loadingNotebooks}
											onclick={onLoadMoreNotebooks}
										>
											{loadingNotebooks ? 'Loading notebooks' : 'Load more notebooks'}
										</button>
									</div>
								{/if}
							{/snippet}
						</ScrollView>

						<footer class="flex justify-end border-t border-border/50 px-2 py-2">
							<Button
								variant="outline"
								size="sm"
								disabled
								title="Add notebook needs a dedicated NoteSystem creation flow."
							>
								<PlusIcon class="size-4" />
								添加笔记本
							</Button>
						</footer>
					</div>
				{:else}
					<div
						class="grid h-full min-h-0 min-w-0 grid-rows-[minmax(10rem,0.9fr)_minmax(0,1.1fr)] lg:grid-cols-[minmax(14rem,0.85fr)_minmax(18rem,1.35fr)] lg:grid-rows-1"
						data-testid="notes-sections-pages-list"
					>
						<section class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] lg:border-r lg:border-border/50" aria-label="Sections">
							<header class="flex min-w-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
								<div class="flex min-w-0 items-center gap-2">
									<LayersIcon class="size-4 text-muted-foreground" />
									<div class="truncate text-sm font-semibold">Sections{sectionsCountLabel}</div>
									{@render sortMenu('排序章节', sectionSort, onSectionSortChange)}
								</div>
							</header>
							<ScrollView
								class="min-h-0"
								viewportTestId="notes-sections-scroll"
								onViewportScroll={handleSectionScroll}
								virtual={{
									items: sections,
									estimateSize: () => 64,
									getItemKey: (_, section) => section.section,
									measureElement: true,
									overscan: 8,
									paddingStart: 8,
									paddingEnd: 8,
								}}
							>
								{#snippet empty()}
									<div class="rounded-md bg-muted/24 px-3 py-4 text-sm text-muted-foreground">
										{loadingSections ? 'Loading sections.' : selectedNotebook ? 'No sections.' : 'Select a notebook.'}
									</div>
								{/snippet}

								{#snippet item(section: NoteSectionSummary)}
									<button
										type="button"
										class={cn(
											'grid w-full gap-1 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60',
											selectedSection === section.section && 'bg-accent text-accent-foreground',
										)}
										aria-pressed={selectedSection === section.section}
										onclick={() => onSelectSection(section.section)}
									>
										<span class="truncate font-medium">{section.section}</span>
										<span class="truncate text-xs text-muted-foreground">{section.pageCount} pages</span>
										<span class="truncate text-[11px] text-muted-foreground">{formatUpdatedAt(section.updatedAt)}</span>
									</button>
								{/snippet}

								{#snippet after()}
									{#if canLoadMoreSections}
										<div class="px-2 pb-2">
											<button
												type="button"
												class="w-full rounded-md bg-muted/28 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/44"
												disabled={loadingSections}
												onclick={onLoadMoreSections}
											>
												{loadingSections ? 'Loading sections' : 'Load more sections'}
											</button>
										</div>
									{/if}
								{/snippet}
							</ScrollView>
							<footer class="flex justify-end border-t border-border/50 px-2 py-2">
								<Button
									variant="outline"
									size="sm"
									disabled
									title="Add section needs a dedicated NoteSystem creation flow."
								>
									<PlusIcon class="size-4" />
									添加章节
								</Button>
							</footer>
						</section>

						<section class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] border-t border-border/50 lg:border-t-0" aria-label="Pages">
							<header class="flex min-w-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
								<div class="flex min-w-0 items-center gap-2">
									<FileTextIcon class="size-4 text-muted-foreground" />
									<div class="truncate text-sm font-semibold">Pages{pagesCountLabel}</div>
									{@render sortMenu('排序页面', pageSort, onPageSortChange)}
								</div>
							</header>
							<ScrollView
								class="min-h-0"
								viewportTestId="notes-pages-scroll"
								onViewportScroll={handlePageScroll}
								virtual={{
									items: pages,
									estimateSize: () => 86,
									getItemKey: (_, notePage) => createNotePageKey(notePage),
									measureElement: true,
									overscan: 8,
									paddingStart: 8,
									paddingEnd: 8,
								}}
							>
								{#snippet empty()}
									<div class="rounded-md bg-muted/24 px-3 py-4 text-sm text-muted-foreground">
										{loadingPages ? 'Loading pages.' : selectedSection ? 'No pages.' : 'Select a section.'}
									</div>
								{/snippet}

								{#snippet item(notePage: NotePageSummary)}
									<button
										type="button"
										class={cn(
											'grid w-full gap-1 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60',
											selectedPageKey === createNotePageKey(notePage) && 'bg-accent text-accent-foreground',
										)}
										aria-pressed={selectedPageKey === createNotePageKey(notePage)}
										onclick={() => onSelectPage(notePage)}
									>
										<span class="truncate font-medium">{notePage.page}</span>
										<span class="line-clamp-2 text-xs text-muted-foreground">{notePage.preview || 'Empty note'}</span>
										<span class="truncate text-[11px] text-muted-foreground">{notePage.mime}</span>
									</button>
								{/snippet}

								{#snippet after()}
									{#if canLoadMorePages}
										<div class="px-2 pb-2">
											<button
												type="button"
												class="w-full rounded-md bg-muted/28 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/44"
												disabled={loadingPages}
												onclick={onLoadMorePages}
											>
												{loadingPages ? 'Loading pages' : 'Load more pages'}
											</button>
										</div>
									{/if}
								{/snippet}
							</ScrollView>
							<footer class="flex justify-end border-t border-border/50 px-2 py-2">
								<Button
									variant="outline"
									size="sm"
									disabled
									title="Add page needs a dedicated NoteSystem creation flow."
								>
									<PlusIcon class="size-4" />
									添加页面
								</Button>
							</footer>
						</section>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>
