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

	import { readHeartbeatPartText, toHeartbeatPartRawText } from './runtime-heartbeat-parts';

	let {
		part,
	}: {
		part: HeartbeatPartItem['parts'][number];
	} = $props();

	const text = $derived(readHeartbeatPartText(part));
	const showMetaRow = $derived((part.mimeType ?? '').length > 0 || !part.isComplete);
</script>

<section class="grid gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-3">
	{#if showMetaRow}
		<div class="flex flex-wrap items-center gap-2">
			{#if part.mimeType}
				<Badge variant="secondary">{part.mimeType}</Badge>
			{/if}
			{#if !part.isComplete}
				<Badge variant="secondary">streaming</Badge>
			{/if}
		</div>
	{/if}

	{#if part.partType === 'thinking'}
		<Reasoning isStreaming={!part.isComplete} defaultOpen={!part.isComplete}>
			<ReasoningTrigger />
			<ReasoningContent>
				<MarkdownDocument
					value={text ?? ''}
					mode="preview"
					usage="chat"
					surface="muted"
					syntaxTone="accented"
					padding="compact"
					class="rounded-xl border border-border/60 bg-background px-3 py-3"
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
			class="rounded-xl border border-border/60 bg-background px-3 py-3"
		/>
	{:else}
		<JSONViewer
			value={part.payload}
			rawText={toHeartbeatPartRawText(part)}
			class="rounded-xl border border-border/60 bg-background px-3 py-3"
		/>
	{/if}
</section>
