<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import DatabaseIcon from '@lucide/svelte/icons/database';

	import type { NoteSqlQueryOutput } from '@agenter/client-sdk';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import { cn } from '$lib/utils.js';

	let {
		capabilityAvailable,
		sqlQuery = $bindable(''),
		sqlOutput,
		runningSql,
		onRunSql,
	}: {
		capabilityAvailable: boolean;
		sqlQuery?: string;
		sqlOutput: NoteSqlQueryOutput | null;
		runningSql: boolean;
		onRunSql: () => void | Promise<void>;
	} = $props();
</script>

<WorkbenchScaffold tone="page" bodyClass="h-full" data-testid="notes-query-mode">
	<div class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 md:p-4">
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
			<Input aria-label="Note SQL query" disabled={!capabilityAvailable} bind:value={sqlQuery} />
		</form>

		<ScrollView class="h-full" contentClass="grid auto-rows-max gap-3 pr-2">
			{#if !capabilityAvailable}
				<NoticeBanner tone="warning" message="Query is disabled because this avatar has no NoteSystem capability." />
			{:else if sqlOutput}
				<div class="grid gap-2 rounded-lg border border-border/60 bg-background/55 p-3 text-xs text-muted-foreground">
					<div>{sqlOutput.rows.length} rows</div>
					<pre class="whitespace-pre-wrap text-[11px] leading-5 text-foreground">{JSON.stringify(sqlOutput.rows, null, 2)}</pre>
				</div>
			{:else}
				<NoticeBanner tone="info" message="Run a read-only query against this avatar's NoteSystem views." />
			{/if}
		</ScrollView>
	</div>
</WorkbenchScaffold>
