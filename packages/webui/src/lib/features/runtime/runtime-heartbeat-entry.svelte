<script lang="ts">
	import type { HeartbeatPartItem } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	import RuntimeHeartbeatPartContent from './runtime-heartbeat-part-content.svelte';
	import {
		getHeartbeatRowLabel,
		getHeartbeatRowMeta,
		getHeartbeatRowPreviewLine,
		isHeartbeatCompactRow,
		isHeartbeatRowFoldedByDefault,
	} from './runtime-heartbeat-parts';
	import { formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		entry,
	}: {
		entry: HeartbeatPartItem;
	} = $props();

	const compactRow = $derived(isHeartbeatCompactRow(entry));
	const foldedByDefault = $derived(isHeartbeatRowFoldedByDefault(entry));
	const summary = $derived(getHeartbeatRowPreviewLine(entry));
	const meta = $derived(getHeartbeatRowMeta(entry));
</script>

<details
	open={!foldedByDefault}
	class={cn(
		'group rounded-3xl border border-border/70 bg-card shadow-sm',
		compactRow ? 'border-dashed bg-muted/30' : '',
	)}
	data-testid={`runtime-heartbeat-entry-${entry.id}`}
>
	<summary
		class={cn(
			'grid cursor-pointer gap-3 px-4 py-3 list-none',
			entry.role === 'assistant' ? 'md:justify-items-start' : 'md:justify-items-end',
		)}
	>
		<div class="flex max-w-[min(58rem,100%)] flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
			<Badge variant="outline">{getHeartbeatRowLabel(entry)}</Badge>
			<Badge variant="secondary">{entry.role}</Badge>
			{#if entry.scope !== 'heartbeat_part'}
				<Badge variant="secondary">{entry.scope}</Badge>
			{/if}
			{#each meta as item (item)}
				<Badge variant="secondary">{item}</Badge>
			{/each}
			<span>{formatRuntimeTimestamp(entry.createdAt)}</span>
		</div>

		<div
			class={cn(
				'max-w-[min(58rem,100%)] text-sm leading-6',
				compactRow ? 'text-muted-foreground' : 'text-foreground',
			)}
		>
			{summary}
		</div>
	</summary>

	<div class="grid gap-3 border-t border-border/60 px-4 py-4">
		{#each entry.parts as part (`${entry.id}:${part.partId}`)}
			<RuntimeHeartbeatPartContent {part} />
		{/each}
	</div>
</details>
