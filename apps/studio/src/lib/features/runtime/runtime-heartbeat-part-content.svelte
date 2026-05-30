<script lang="ts">
	import type { HeartbeatPartItem } from '@agenter/client-sdk';

	import {
		Reasoning,
		ReasoningContent,
		ReasoningTrigger,
	} from '$lib/components/ai-elements/reasoning/index.js';
	import MarkdownDocument from '$lib/components/web-components/markdown-document.svelte';
	import JSONViewer from '$lib/components/web-components/json-viewer.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';

	import {
		formatHeartbeatPartTypeLabel,
		readHeartbeatPartText,
		toHeartbeatPartRawText,
	} from './runtime-heartbeat-parts';

	let {
		part,
		layoutMode = 'compact',
	}: {
		part: HeartbeatPartItem['parts'][number];
		layoutMode?: 'compact' | 'detailed';
	} = $props();

	const text = $derived(readHeartbeatPartText(part));
	const showMetaRow = $derived((part.mimeType ?? '').length > 0 || !part.isComplete);
	const showTypeLabel = $derived(!['text', 'thinking', 'compact'].includes(part.partType));
	const shouldOpenReasoning = $derived(layoutMode === 'detailed' || !part.isComplete);
</script>

<section class="grid min-w-0 gap-1.5">
	{#if showTypeLabel || showMetaRow}
		<div class="flex flex-wrap items-center gap-1.5">
			{#if showTypeLabel}
				<Badge variant="outline" class="px-1.5 py-0 text-[10px]">{formatHeartbeatPartTypeLabel(part.partType)}</Badge>
			{/if}
			{#if part.mimeType}
				<Badge variant="secondary" class="px-1.5 py-0 text-[10px]">{part.mimeType}</Badge>
			{/if}
			{#if !part.isComplete}
				<Badge variant="secondary" class="px-1.5 py-0 text-[10px]">streaming</Badge>
			{/if}
		</div>
	{/if}

	{#if part.partType === 'thinking'}
		<Reasoning isStreaming={!part.isComplete} defaultOpen={shouldOpenReasoning}>
			<ReasoningTrigger />
			<ReasoningContent>
				<MarkdownDocument
					value={text ?? ''}
					mode="preview"
					usage="chat"
					surface="muted"
					syntaxTone="accented"
					padding="compact"
					class="min-w-0 rounded-lg bg-background/70 px-2.5 py-2"
				/>
			</ReasoningContent>
		</Reasoning>
	{:else if text !== null}
		<MarkdownDocument
			value={text}
			mode="preview"
			usage="chat"
			surface="muted"
			syntaxTone="accented"
			padding="compact"
			class="min-w-0 rounded-lg bg-background/70 px-2.5 py-2"
		/>
	{:else}
		<JSONViewer
			value={part.payload}
			rawText={toHeartbeatPartRawText(part)}
			plain
			class="min-w-0 w-full max-w-full rounded-lg bg-background/70 px-2.5 py-2"
		/>
	{/if}
</section>
