<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import * as Skeleton from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';
	import type { NotePageIdentity, NotePageResultItem } from './notes-state';

	let {
		items,
		selectedPageKey,
		loading = false,
		emptyMessage,
		placeholderMessage = null,
		viewportTestId,
		rowTestId,
		onSelectPage,
	}: {
		items: NotePageResultItem[];
		selectedPageKey: string;
		loading?: boolean;
		emptyMessage: string | null;
		placeholderMessage?: string | null;
		viewportTestId: string;
		rowTestId: string;
		onSelectPage: (identity: NotePageIdentity) => void;
	} = $props();

	const loadingRows = [0, 1, 2, 3, 4];

	const selectResult = (item: NotePageResultItem): void => {
		if (item.identity) {
			onSelectPage(item.identity);
		}
	};
</script>

<ScrollView class="min-h-0" contentClass="grid auto-rows-max gap-2 pr-2" {viewportTestId}>
	{#if loading}
		{#each loadingRows as row (row)}
			<div
				class="grid gap-2 rounded-md border border-border/60 bg-background/55 p-3"
				aria-hidden="true"
				data-testid="notes-result-skeleton-row"
			>
				<div class="flex min-w-0 items-start justify-between gap-2">
					<div class="grid min-w-0 flex-1 gap-1.5">
						<Skeleton.Root class="h-4 w-2/5" />
						<Skeleton.Root class="h-3 w-3/5" />
					</div>
					<div class="flex shrink-0 gap-1">
						<Skeleton.Root class="h-5 w-14 rounded-full" />
						<Skeleton.Root class="h-5 w-10 rounded-full" />
					</div>
				</div>
				<Skeleton.Root class="h-3 w-full" />
				<Skeleton.Root class="h-3 w-3/4" />
			</div>
		{/each}
	{:else}
		{#if items.length === 0 && emptyMessage}
			<NoticeBanner tone="info" message={emptyMessage} />
		{/if}
		{#each items as item (item.key)}
			{@const selected = item.identity ? selectedPageKey === item.key : false}
			<button
				type="button"
				class={cn(
					'grid gap-2 rounded-md border border-border/60 bg-background/55 p-3 text-left transition-colors',
					item.identity ? 'hover:bg-muted/50' : 'cursor-default opacity-80',
					selected && 'border-primary/45 bg-accent/55',
				)}
				aria-pressed={selected}
				aria-disabled={!item.identity}
				disabled={!item.identity}
				title={item.disabledReason}
				data-testid={rowTestId}
				onclick={() => selectResult(item)}
			>
				<div class="flex min-w-0 items-start justify-between gap-2">
					<div class="grid min-w-0 gap-0.5">
						<div class="min-w-0 truncate text-sm font-medium">{item.title}</div>
						{#if item.subtitle}
							<div class="min-w-0 truncate text-xs text-muted-foreground">{item.subtitle}</div>
						{/if}
					</div>
					{#if item.badges.length > 0}
						<div class="flex shrink-0 flex-wrap justify-end gap-1">
							{#each item.badges as badge (badge.label)}
								<Badge variant="outline" title={badge.title}>{badge.label}</Badge>
							{/each}
						</div>
					{/if}
				</div>
				{#if item.description}
					<p class="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
				{/if}
				{#if item.fields.length > 0}
					<div class="flex min-w-0 flex-wrap gap-1">
						{#each item.fields.slice(0, 6) as field (field.label)}
							<span class="max-w-full truncate rounded bg-muted/35 px-1.5 py-0.5 text-[11px] text-muted-foreground">
								{field.label}: {field.value}
							</span>
						{/each}
					</div>
				{/if}
			</button>
		{/each}
		{#if items.length === 0 && placeholderMessage}
			<div class="rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
				{placeholderMessage}
			</div>
		{/if}
	{/if}
</ScrollView>
