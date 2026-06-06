<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import NotebookTextIcon from '@lucide/svelte/icons/notebook-text';

	import type { NoteCatalogOutput } from '@agenter/client-sdk';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import { cn } from '$lib/utils.js';
	import { createNotePageKey, type NotePageIdentity } from './notes-state';

	let {
		catalog,
		capabilityAvailable,
		loadingCatalog,
		error,
		selectedPageKey,
		onSelectPage,
	}: {
		catalog: NoteCatalogOutput | null;
		capabilityAvailable: boolean;
		loadingCatalog: boolean;
		error: string | null;
		selectedPageKey: string;
		onSelectPage: (identity: NotePageIdentity) => void;
	} = $props();

	const readableRoots = $derived(catalog?.capability.readableRoots ?? []);
	const sourceRootHelpText = $derived.by(() => {
		if (!catalog?.capability.available) {
			return 'Readable source roots appear after NoteSystem capability is available.';
		}
		return [
			'Workspace/source facts are metadata inside this avatar tab; they do not switch the tab role.',
			...readableRoots.map((root) => `- ${root}`),
		].join('\n');
	});
</script>

<WorkbenchScaffold tone="page" bodyClass="h-full" data-testid="notes-browse-mode">
	<div class="grid h-full gap-3 p-3 md:p-4">
		<section class="grid h-full min-w-0 gap-3" aria-label="Note notebooks">
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
					<div class="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						<span>Notebooks</span>
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
								{#if catalog?.capability.available}
									<div class="grid gap-1">
										{#each readableRoots as root (root)}
											<div class="break-all rounded-md border border-border/60 bg-background/75 px-2 py-1 text-xs text-foreground">
												{root}
											</div>
										{/each}
									</div>
								{:else}
									<div class="text-xs text-muted-foreground">
										Readable source roots appear after NoteSystem capability is available.
									</div>
								{/if}
							</div>
						</HelpHint>
					</div>
					<Badge variant="outline">{catalog?.totalPages ?? 0} pages</Badge>
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
										onclick={() => onSelectPage(notePage)}
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
	</div>
</WorkbenchScaffold>
