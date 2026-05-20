<script lang="ts">
	import type { RequestAuxItem } from '@agenter/client-sdk';

import JSONViewer from '$lib/components/web-components/json-viewer.svelte';
import { Badge } from '$lib/components/ui/badge/index.js';

	import { formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		entry,
	}: {
		entry: RequestAuxItem;
	} = $props();

	const toRawText = (value: unknown): string => {
		if (typeof value === 'string') {
			return value;
		}
		return JSON.stringify(value, null, 2);
	};

const isSystemPromptPart = (partType: string, payload: unknown): payload is string =>
	partType === 'systemPrompt' && typeof payload === 'string';
</script>

<section class="grid gap-3 px-4 py-3" data-testid={`runtime-heartbeat-request-aux-${entry.id}`}>
	<div class="flex max-w-[min(58rem,100%)] flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
		<Badge variant="outline">request aux</Badge>
		<Badge variant="secondary">round {entry.roundIndex}</Badge>
		{#if entry.aiCallId !== null}
			<Badge variant="secondary">call #{entry.aiCallId}</Badge>
		{/if}
		<span>{formatRuntimeTimestamp(entry.createdAt)}</span>
	</div>

	<div class="grid max-w-[min(58rem,100%)] gap-3 rounded-3xl border border-border/70 bg-card px-4 py-4 shadow-sm">
		{#each entry.parts as part (`${entry.id}:${part.partId}`)}
			<section class="grid gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-3">
				<div class="flex flex-wrap items-center gap-2">
					<Badge variant="outline">{part.partType}</Badge>
					{#if part.mimeType}
						<Badge variant="secondary">{part.mimeType}</Badge>
					{/if}
					{#if !part.isComplete}
						<Badge variant="secondary">streaming</Badge>
					{/if}
				</div>

				{#if isSystemPromptPart(part.partType, part.payload)}
					<div
						class="rounded-xl border border-border/60 bg-background px-3 py-3 font-mono text-xs leading-6 whitespace-pre-wrap break-words"
					>
						{part.payload}
					</div>
				{:else}
					<JSONViewer
						value={part.payload}
						rawText={toRawText(part.payload)}
						class="rounded-xl border border-border/60 bg-background px-3 py-3"
					/>
				{/if}
			</section>
		{/each}
	</div>
</section>
