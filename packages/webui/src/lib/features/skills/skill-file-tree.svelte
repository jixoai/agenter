<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FileIcon from '@lucide/svelte/icons/file';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
	import { ScrollView } from '@agenter/svelte-components';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';
	import type { SkillTreeRow } from './skill-browser-state';

	let {
		rows,
		selectedPath,
		expandedPaths,
		viewportTestId,
		onSelectFile,
		onToggleDirectory,
		onLoadMore,
	}: {
		rows: SkillTreeRow[];
		selectedPath: string | null;
		expandedPaths: ReadonlySet<string>;
		viewportTestId?: string;
		onSelectFile: (path: string) => void | Promise<void>;
		onToggleDirectory: (path: string) => void | Promise<void>;
		onLoadMore: (path: string) => void | Promise<void>;
	} = $props();
</script>

<ScrollView
	class="h-full"
	viewportTestId={viewportTestId}
	virtual={{
		items: rows,
		estimateSize: (_, row) => (row.type === 'load-more' ? 40 : 60),
		getItemKey: (_, row) => (row.type === 'entry' ? `entry:${row.entry.path}` : `load-more:${row.parentPath}`),
		measureElement: true,
		overscan: 8,
		paddingStart: 8,
		paddingEnd: 8,
	}}
>
	{#snippet empty()}
		<div class="rounded-[0.85rem] bg-muted/24 px-4 py-6 text-sm text-muted-foreground">
			No files are visible in this skill.
		</div>
	{/snippet}

	{#snippet item(row)}
		{#if row.type === 'entry'}
			{@const selected = selectedPath === row.entry.path}
			{@const expanded = row.entry.kind === 'directory' && expandedPaths.has(row.entry.path)}
			<button
				type="button"
				data-skill-tree-path={row.entry.path}
				class={cn(
					'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[0.8rem] px-3 py-2 text-left transition-colors hover:bg-muted/28',
					selected && 'bg-primary/8 ring-1 ring-primary/30',
				)}
				style={`padding-inline-start: calc(${row.depth} * 1rem + 0.75rem);`}
				onclick={() => {
					if (row.entry.kind === 'directory') {
						void onToggleDirectory(row.entry.path);
						return;
					}
					void onSelectFile(row.entry.path);
				}}
			>
				<div class="flex items-center gap-2">
					{#if row.entry.kind === 'directory'}
						<ChevronRightIcon class={cn('size-4 transition-transform', expanded && 'rotate-90')} />
						<FolderIcon class="size-4 text-muted-foreground" />
					{:else if row.entry.previewKind === 'image' || row.entry.previewKind === 'audio' || row.entry.previewKind === 'video' || row.entry.previewKind === 'pdf'}
						<HardDriveIcon class="size-4 text-muted-foreground" />
					{:else}
						<FileIcon class="size-4 text-muted-foreground" />
					{/if}
				</div>
				<div class="min-w-0">
					<div class="truncate text-sm font-medium">{row.entry.name}</div>
					<div class="truncate text-[11px] text-muted-foreground">{row.entry.path}</div>
				</div>
				<div class="flex items-center gap-2">
					<Badge variant="outline">{row.entry.previewKind}</Badge>
				</div>
			</button>
		{:else}
			<button
				type="button"
				class="justify-self-start rounded-[0.8rem] bg-muted/24 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/38"
				style={`margin-inline-start: calc(${row.depth} * 1rem + 0.75rem);`}
				onclick={() => {
					void onLoadMore(row.parentPath);
				}}
			>
				Load {row.remainingCount} more
			</button>
		{/if}
	{/snippet}
</ScrollView>
