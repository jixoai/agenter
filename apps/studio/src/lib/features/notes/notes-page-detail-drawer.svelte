<script lang="ts">
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import LinkIcon from '@lucide/svelte/icons/link';

	import type { NotePageOutput } from '@agenter/client-sdk';
	import FilePreviewFrame from '$lib/components/file-preview/file-preview-frame.svelte';
	import { resolveFilePreviewKindFromMime, type FilePreviewPayload } from '$lib/components/file-preview/file-preview-state';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import { createNotePageKey, type NotePageIdentity } from './notes-state';

	let {
		selectedPage,
		pageOutput,
		loadingPage,
		avatarLabel,
		avatarNickname,
	}: {
		selectedPage: NotePageIdentity | null;
		pageOutput: NotePageOutput | null;
		loadingPage: boolean;
		avatarLabel: string;
		avatarNickname: string;
	} = $props();

	const selectedPageFact = $derived(pageOutput?.page ?? null);

	const formatTimestamp = (value: string | null | undefined): string => {
		if (!value) {
			return 'Unknown';
		}
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
	};

	const buildNotePageSourceUrl = (identity: NotePageIdentity): string => {
		const params = new URLSearchParams({
			avatarNickname,
			notebook: identity.notebook,
			section: identity.section,
			page: identity.page,
		});
		return `/api/notes/page?${params.toString()}`;
	};

	const metadataRows = $derived.by(() => {
		if (!selectedPageFact) {
			return [];
		}
		return [
			{ label: 'Avatar', value: avatarLabel },
			{ label: 'Book ID', value: selectedPageFact.metadata.bookId },
			{ label: 'Section ID', value: selectedPageFact.metadata.sectionId },
			{ label: 'Page ID', value: selectedPageFact.metadata.pageId },
			{ label: 'MIME', value: selectedPageFact.metadata.mime },
			{ label: 'Created', value: formatTimestamp(selectedPageFact.metadata.createdAt) },
			{ label: 'Updated', value: formatTimestamp(selectedPageFact.metadata.updatedAt) },
			...(selectedPageFact.metadata.sourceWorkspace
				? [{ label: 'Source', value: selectedPageFact.metadata.sourceWorkspace }]
				: []),
		];
	});

	const metadataHelpText = $derived.by(() => {
		if (!selectedPageFact) {
			return 'Select a note page to inspect its NoteSystem metadata.';
		}
		const lines = metadataRows.map((row) => `${row.label}: ${row.value}`);
		if (selectedPageFact.metadata.tags.length > 0) {
			lines.push(`Tags: ${selectedPageFact.metadata.tags.join(', ')}`);
		}
		if (selectedPageFact.metadata.references.length > 0) {
			lines.push(
				`References: ${selectedPageFact.metadata.references
					.map((reference) => `${reference.notebook}/${reference.section}/${reference.page}`)
					.join(', ')}`,
			);
		}
		return lines.join('\n');
	});

	const notePreview = $derived.by((): FilePreviewPayload | null => {
		if (!selectedPageFact) {
			return null;
		}
		return {
			path: selectedPageFact.path,
			name: selectedPageFact.identity.page,
			kind: 'file',
			sizeBytes: selectedPageFact.content.sizeBytes,
			modifiedAtMs: new Date(selectedPageFact.metadata.updatedAt).getTime() || 0,
			previewKind: resolveFilePreviewKindFromMime(selectedPageFact.metadata.mime),
			mimeType: selectedPageFact.metadata.mime,
			textContent: null,
			mediaDataUrl: null,
			truncated: false,
			note: selectedPageFact.content.inline ? null : 'This note page uses file-backed content.',
			source: {
				protocol: 'http',
				url: buildNotePageSourceUrl(selectedPageFact.identity),
				auth: 'browser',
			},
		};
	});
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
					<HelpHint
						ariaLabel="Note metadata"
						align="start"
						side="bottom"
						textContext={metadataHelpText}
					>
						<div class="grid max-w-[24rem] gap-2 text-left">
							<div class="text-sm font-semibold text-foreground">Metadata</div>
							<div class="grid gap-1.5">
								{#each metadataRows as row (row.label)}
									<div class="grid gap-0.5">
										<div class="text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
											{row.label}
										</div>
										<div class="break-all text-xs text-foreground">{row.value}</div>
									</div>
								{/each}
							</div>
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
										<div class="break-all text-xs text-foreground">
											{reference.notebook} / {reference.section} / {reference.page}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</HelpHint>
				</div>
			</div>
			{#if notePreview}
				<div class="h-[min(34rem,55dvh)] min-h-[18rem] min-w-0">
					<FilePreviewFrame preview={notePreview} title={`${selectedPageFact.identity.page} preview`} />
				</div>
			{/if}
		</div>
	{/if}
</WorkbenchDetailDrawer>
