<script lang="ts">
	import type { ModelCallDeltaItem, ModelCallItem } from '@agenter/client-sdk';

import JSONViewer from '$lib/components/web-components/json-viewer.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	import { formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		entry,
		liveDeltas = [],
	}: {
		entry: ModelCallItem;
		liveDeltas?: ModelCallDeltaItem[];
	} = $props();

	let activeTab = $state<'summary' | 'request' | 'response' | 'live'>('summary');

	const asRecord = (value: unknown): Record<string, unknown> | null => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			return null;
		}
		return value as Record<string, unknown>;
	};

	const toRawText = (value: unknown): string => JSON.stringify(value, null, 2);

	const responseRecord = $derived(asRecord(entry.response));
	const assistantRecord = $derived(asRecord(responseRecord?.assistant));
	const assistantText = $derived(
		typeof assistantRecord?.text === 'string'
			? assistantRecord.text
			: typeof responseRecord?.output_text === 'string'
				? responseRecord.output_text
				: '',
	);
	const assistantThinking = $derived(
		typeof assistantRecord?.thinking === 'string'
			? assistantRecord.thinking
			: typeof responseRecord?.reasoning === 'string'
				? responseRecord.reasoning
				: '',
	);
	const statusVariant = $derived(
		entry.status === 'error' ? 'destructive' : entry.status === 'running' ? 'secondary' : 'outline',
	);
</script>

<section class="grid gap-3 px-4 py-3" data-testid={`runtime-heartbeat-model-call-${entry.id}`}>
	<div class="flex max-w-[min(62rem,100%)] flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
		<Badge variant="outline">model call</Badge>
		<Badge variant={statusVariant}>#{entry.id}</Badge>
		<Badge variant="secondary">{entry.kind}</Badge>
		<Badge variant="secondary">{entry.provider}</Badge>
		<Badge variant="secondary">{entry.model}</Badge>
		<span>{formatRuntimeTimestamp(entry.createdAt)}</span>
	</div>

	<div class="grid max-w-[min(62rem,100%)] gap-4 rounded-3xl border border-border/70 bg-card px-4 py-4 shadow-sm">
		<div class="grid gap-2">
			<div class="text-sm font-semibold text-foreground">{entry.requestUrl}</div>
			<div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
				<span>round {entry.roundIndex}</span>
				{#if entry.cycleId !== null}
					<span>cycle {entry.cycleId}</span>
				{/if}
				{#if entry.completedAt}
					<span>completed {formatRuntimeTimestamp(entry.completedAt)}</span>
				{/if}
				{#if liveDeltas.length > 0}
					<span>{liveDeltas.length} live delta{liveDeltas.length > 1 ? 's' : ''}</span>
				{/if}
			</div>
		</div>

		<Tabs.Root
			value={activeTab}
			onValueChange={(value) => (activeTab = value as 'summary' | 'request' | 'response' | 'live')}
		>
			<Tabs.List class="grid w-full grid-cols-2 lg:grid-cols-4">
				<Tabs.Trigger value="summary">Summary</Tabs.Trigger>
				<Tabs.Trigger value="request">Request</Tabs.Trigger>
				<Tabs.Trigger value="response">Response</Tabs.Trigger>
				<Tabs.Trigger value="live">Live</Tabs.Trigger>
			</Tabs.List>
		</Tabs.Root>

		{#if activeTab === 'summary'}
			<div class="grid gap-3">
				{#if assistantText}
					<section class="grid gap-2 rounded-2xl border border-border/60 bg-background px-3 py-3">
						<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Assistant</div>
						<div class="whitespace-pre-wrap break-words text-sm leading-7">{assistantText}</div>
					</section>
				{/if}
				{#if assistantThinking}
					<section class="grid gap-2 rounded-2xl border border-border/60 bg-background px-3 py-3">
						<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Thinking</div>
						<div class="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
							{assistantThinking}
						</div>
					</section>
				{/if}
				{#if !assistantText && !assistantThinking}
					<div class="rounded-2xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
						No assistant summary has been persisted for this model call yet.
					</div>
				{/if}
			</div>
		{:else if activeTab === 'request'}
			<JSONViewer value={entry.request} rawText={toRawText(entry.request)} class="rounded-2xl border border-border/60 bg-background px-3 py-3" />
		{:else if activeTab === 'response'}
			<div class="grid gap-3">
				{#if entry.error}
					<JSONViewer value={entry.error} rawText={toRawText(entry.error)} class="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-3" />
				{/if}
				<JSONViewer
					value={entry.response}
					rawText={toRawText(entry.response)}
					class="rounded-2xl border border-border/60 bg-background px-3 py-3"
				/>
			</div>
		{:else if liveDeltas.length === 0}
			<div class="rounded-2xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
				No in-flight deltas are attached to this model call.
			</div>
		{:else}
			<div class="grid gap-3">
				{#each liveDeltas as delta (delta.id)}
					<section class="grid gap-2 rounded-2xl border border-border/60 bg-background px-3 py-3">
						<div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
							<Badge variant="outline">{delta.kind}</Badge>
							<span>seq {delta.seq}</span>
							<span>{formatRuntimeTimestamp(delta.timestamp)}</span>
						</div>
						<JSONViewer value={delta.data} rawText={toRawText(delta.data)} />
					</section>
				{/each}
			</div>
		{/if}
	</div>
</section>
