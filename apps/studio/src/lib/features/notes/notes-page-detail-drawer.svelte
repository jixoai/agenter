<script lang="ts">
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import LinkIcon from '@lucide/svelte/icons/link';

	import type { NotePageOutput } from '@agenter/client-sdk';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import { createNotePageKey, type NotePageIdentity } from './notes-state';

	let {
		selectedPage,
		pageOutput,
		loadingPage,
		avatarLabel,
	}: {
		selectedPage: NotePageIdentity | null;
		pageOutput: NotePageOutput | null;
		loadingPage: boolean;
		avatarLabel: string;
	} = $props();

	const selectedPageFact = $derived(pageOutput?.page ?? null);

	const formatTimestamp = (value: string | null | undefined): string => {
		if (!value) {
			return 'Unknown';
		}
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
	};
</script>

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
