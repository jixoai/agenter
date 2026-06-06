<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import SearchIcon from '@lucide/svelte/icons/search';
	import TagsIcon from '@lucide/svelte/icons/tags';

	import type { NoteSearchOutput, NoteTagSummary } from '@agenter/client-sdk';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import { cn } from '$lib/utils.js';
	import type { NotePageIdentity, NoteSearchRow } from './notes-state';

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
		onFilterTag,
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
		onFilterTag: (tagName: string) => void | Promise<void>;
		onSelectPage: (identity: NotePageIdentity) => void;
	} = $props();
</script>

<WorkbenchScaffold tone="page" bodyClass="h-full" data-testid="notes-search-mode">
	<div class="grid h-full min-w-0 gap-3 p-3 md:grid-cols-[minmax(14rem,0.42fr)_minmax(0,1fr)] md:p-4">
		<section class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3" aria-label="Note search filters">
			<form
				class="grid gap-2"
				onsubmit={(event) => {
					event.preventDefault();
					void onRunSearch();
				}}
			>
				<div class="relative min-w-0">
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

			<div class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 rounded-lg border border-border/60 bg-background/55 p-2">
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						<TagsIcon class={cn('size-3.5', loadingTags && 'animate-pulse')} />
						<span>Tags</span>
					</div>
					<Badge variant="outline">{tagRows.length}</Badge>
				</div>
				<ScrollView class="h-full" contentClass="flex flex-wrap content-start gap-1 pr-2">
					{#each tagRows as tag (tag.id)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="h-7 px-2 text-xs"
							disabled={!capabilityAvailable}
							onclick={() => void onFilterTag(tag.name)}
						>
							{tag.name}
							<span class="text-muted-foreground">{tag.count}</span>
						</Button>
					{/each}
					{#if tagRows.length === 0}
						<span class="text-xs text-muted-foreground">No tags indexed.</span>
					{/if}
				</ScrollView>
			</div>
		</section>

		<section class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3" aria-label="Note search results">
			<div class="flex items-center justify-between gap-2 px-1">
				<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Results</div>
				<Badge variant="outline">{searchRows.length}</Badge>
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
						onclick={() => onSelectPage(result)}
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
						<div>Catalog browsing stays in Browse mode.</div>
					</div>
				{/if}
			</ScrollView>
		</section>
	</div>
</WorkbenchScaffold>
