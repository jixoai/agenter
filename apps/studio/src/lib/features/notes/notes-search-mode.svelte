<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import TagsIcon from '@lucide/svelte/icons/tags';

	import type { NoteSearchOutput, NoteTagSummary } from '@agenter/client-sdk';
	import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '$lib/components/ui/accordion/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';
	import NotesPageResultList from './notes-page-result-list.svelte';
	import { mapNoteSearchResultItems, type NotePageIdentity, type NoteSearchRow } from './notes-state';
	import { upsertNotesSearchTag } from './notes-search-syntax';

	let {
		capabilityAvailable,
		searchQuery = $bindable(''),
		searchOutput,
		searchRows,
		tagRows,
		loadingTags,
		searching,
		selectedPageKey,
		onRunSearch,
		onSelectPage,
	}: {
		capabilityAvailable: boolean;
		searchQuery?: string;
		searchOutput: NoteSearchOutput | null;
		searchRows: NoteSearchRow[];
		tagRows: NoteTagSummary[];
		loadingTags: boolean;
		searching: boolean;
		selectedPageKey: string;
		onRunSearch: () => void | Promise<void>;
		onSelectPage: (identity: NotePageIdentity) => void;
	} = $props();

	const tagsFromSearchRows = $derived.by(() => {
		const counts = new Map<string, NoteTagSummary>();
		for (const row of searchRows) {
			for (const tag of row.tags) {
				const current = counts.get(tag);
				counts.set(tag, {
					id: current?.id ?? tag,
					name: tag,
					count: (current?.count ?? 0) + 1,
				});
			}
		}
		return [...counts.values()].sort((left, right) => left.name.localeCompare(right.name));
	});
	const shouldShowAllTags = $derived(searchQuery.trim().length === 0 || !searchOutput || searchRows.length === 0);
	const visibleTags = $derived(shouldShowAllTags ? tagRows : tagsFromSearchRows);
	const resultItems = $derived(mapNoteSearchResultItems(searchRows));
	const replaceTagInputOnClick = $derived(searchQuery.trim().length === 0 || Boolean(searchOutput && searchRows.length === 0));
	let tagsOpen = $state<string[]>(['tags']);

	const applyTag = (tagName: string): void => {
		searchQuery = upsertNotesSearchTag(searchQuery, tagName, { replace: replaceTagInputOnClick });
		queueMicrotask(() => void onRunSearch());
	};
</script>

<section
	class="grid h-full min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 p-3 md:p-4"
	aria-label="Note search"
	data-testid="notes-search-mode"
>
	<form
		class="flex min-w-0 items-center gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			void onRunSearch();
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

	<Accordion bind:value={tagsOpen} type="multiple" class="border-border/55 bg-background/45" data-testid="notes-search-tags-accordion">
		<AccordionItem value="tags">
			<AccordionTrigger class="items-center px-3 py-2 hover:no-underline">
				<div class="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
					<TagsIcon class={cn('size-3.5', loadingTags && 'animate-pulse')} />
					<span>Tags</span>
					{#if visibleTags.length > 0 && !loadingTags}
						<Badge variant="outline">{visibleTags.length}</Badge>
					{/if}
				</div>
			</AccordionTrigger>
			<AccordionContent class="pb-2">
				<div class={cn('flex flex-wrap content-start gap-1 overflow-hidden pr-2', tagsOpen.includes('tags') ? 'max-h-16' : 'max-h-0')}>
					{#each visibleTags as tag (tag.id)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="h-7 px-2 text-xs"
							disabled={!capabilityAvailable}
							onclick={() => applyTag(tag.name)}
						>
							{tag.name}
							<span class="text-muted-foreground">{tag.count}</span>
						</Button>
					{/each}
					{#if visibleTags.length === 0}
						<span class="text-xs text-muted-foreground">No tags indexed.</span>
					{/if}
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>

	<section class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3" aria-label="Note search results">
		<div class="flex items-center justify-between gap-2 px-1">
			<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Results</div>
			{#if searchOutput && searchRows.length > 0}
				<Badge variant="outline">{searchRows.length}</Badge>
			{/if}
		</div>
		<NotesPageResultList
			items={resultItems}
			{selectedPageKey}
			loading={searching}
			emptyMessage={searchOutput && searchRows.length === 0 ? 'No matching notes.' : null}
			placeholderMessage={!searchOutput ? 'Search results appear here.' : null}
			viewportTestId="notes-search-scroll"
			rowTestId="notes-search-result-row"
			{onSelectPage}
		/>
	</section>
</section>
