<script lang="ts">
	import { SqlEditor } from '@jixo/codemirror';
	import DatabaseIcon from '@lucide/svelte/icons/database';

	import type { NoteSqlQueryOutput } from '@agenter/client-sdk';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import { cn } from '$lib/utils.js';
	import NotesPageResultList from './notes-page-result-list.svelte';
	import { mapNoteSqlResultItems, type NotePageIdentity } from './notes-state';

	let {
		capabilityAvailable,
		sqlQuery = $bindable(''),
		sqlOutput,
		runningSql,
		selectedPageKey,
		onRunSql,
		onSelectPage,
	}: {
		capabilityAvailable: boolean;
		sqlQuery?: string;
		sqlOutput: NoteSqlQueryOutput | null;
		runningSql: boolean;
		selectedPageKey: string;
		onRunSql: () => void | Promise<void>;
		onSelectPage: (identity: NotePageIdentity) => void;
	} = $props();

	const resultItems = $derived(mapNoteSqlResultItems(sqlOutput));
</script>

<section
	class="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 md:p-4"
	aria-label="Note SQL query"
	data-testid="notes-query-mode"
>
	<form
		class="grid gap-2 rounded-lg border border-border/60 bg-background/55 p-3"
		aria-label="Read-only note SQL query"
		onsubmit={(event) => {
			event.preventDefault();
			void onRunSql();
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
		<SqlEditor
			ariaLabel="Note SQL query"
			placeholder="select notebook, section, page from note_pages_view"
			disabled={!capabilityAvailable}
			bind:value={sqlQuery}
			class="rounded-md border border-input bg-background/70"
		/>
	</form>

	<section class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3" aria-label="Note SQL query results">
		<div class="flex items-center justify-between gap-2 px-1">
			<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rows</div>
			{#if sqlOutput && sqlOutput.rows.length > 0}
				<Badge variant="outline">{sqlOutput.rows.length}</Badge>
			{/if}
		</div>
		{#if !capabilityAvailable}
			<div class="min-h-0">
				<NoticeBanner tone="warning" message="Query is disabled because this avatar has no NoteSystem capability." />
			</div>
		{:else}
			<NotesPageResultList
				items={resultItems}
				{selectedPageKey}
				loading={runningSql}
				emptyMessage={sqlOutput && sqlOutput.rows.length === 0 ? 'No rows returned.' : null}
				placeholderMessage={!sqlOutput ? "Run a read-only query against this avatar's NoteSystem views." : null}
				viewportTestId="notes-query-scroll"
				rowTestId="notes-query-result-row"
				{onSelectPage}
			/>
		{/if}
	</section>
</section>
