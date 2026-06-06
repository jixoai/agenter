<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';
	import type { McpLifecycleState, McpProjectState, McpWorkbenchRow } from './mcp-workbench-state';

	let {
		rows,
		selectedName,
		onSelect,
	}: {
		rows: readonly McpWorkbenchRow[];
		selectedName: string;
		onSelect: (name: string) => void;
	} = $props();

	const lifecycleTone = (lifecycle: McpLifecycleState): 'outline' | 'secondary' | 'destructive' => {
		if (lifecycle === 'failed') {
			return 'destructive';
		}
		if (lifecycle === 'running') {
			return 'outline';
		}
		return 'secondary';
	};

	const projectStateLabel = (state: McpProjectState): string =>
		state === 'enabled' ? 'enabled' : 'default disabled';
</script>

<div class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)]" data-testid="mcp-server-list">
	<div
		class="hidden min-w-0 grid-cols-[minmax(13rem,0.95fr)_minmax(14rem,1fr)_minmax(11rem,0.75fr)] gap-3 border-b border-border/50 px-4 py-2.5 md:grid"
	>
		<div class="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Global config</div>
		<div class="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Exact-project projection</div>
		<div class="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Latest fact</div>
	</div>
	<div class="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 md:hidden">
		<div class="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Global registry</div>
		<Badge variant="outline">{rows.length} installed</Badge>
	</div>

	<ScrollView class="h-full" contentClass="grid gap-0">
		{#each rows as row (row.name)}
			<button
				type="button"
				class={cn(
					'grid w-full gap-3 border-b border-border/45 px-3 py-3 text-left transition-colors last:border-b-0 md:grid-cols-[minmax(13rem,0.95fr)_minmax(14rem,1fr)_minmax(11rem,0.75fr)] md:px-4',
					selectedName === row.name ? 'bg-accent/45' : 'hover:bg-muted/22',
				)}
				aria-pressed={selectedName === row.name}
				onclick={() => onSelect(row.name)}
			>
				<div class="grid min-w-0 gap-1">
					<div class="flex min-w-0 items-center gap-2">
						<div class="truncate text-sm font-semibold">{row.title}</div>
						<Badge variant="secondary" class="shrink-0">{row.transport}</Badge>
					</div>
					<div class="truncate text-xs text-muted-foreground">{row.description}</div>
					<div class="flex min-w-0 flex-wrap items-center gap-1.5">
						<Badge variant="secondary">installed</Badge>
						<Badge variant="outline">{row.name}</Badge>
					</div>
				</div>

				<div class="grid min-w-0 content-start gap-1">
					<div class="flex min-w-0 flex-wrap items-center gap-1.5">
						<Badge variant={row.projectState === 'enabled' ? 'outline' : 'secondary'}>
							{projectStateLabel(row.projectState)}
						</Badge>
						<Badge variant={lifecycleTone(row.lifecycle)}>{row.lifecycle}</Badge>
						<Badge variant="outline">{row.tools.length} tools</Badge>
						<Badge variant="secondary">{row.resources.length} resources</Badge>
						<Badge variant="secondary">{row.prompts.length} prompts</Badge>
						{#if row.latestError}
							<Badge variant="destructive">error</Badge>
						{/if}
					</div>
					<div class="truncate text-xs text-muted-foreground">
						{row.snapshotAt ? `snapshot ${row.snapshotAt}` : 'no project-local snapshot'}
					</div>
				</div>

				<div class="grid min-w-0 content-start gap-1 md:justify-items-end">
					<Badge
						variant={row.latestAction.status === 'failed' || row.latestAction.status === 'blocked'
							? 'destructive'
							: 'secondary'}
					>
						{row.latestAction.operation}
					</Badge>
					<div class="max-w-full truncate text-xs text-muted-foreground">{row.latestAction.label}</div>
				</div>
			</button>
		{/each}
	</ScrollView>
</div>
