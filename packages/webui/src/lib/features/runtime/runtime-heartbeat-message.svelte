<script lang="ts">
	import type { RuntimeChatMessage } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	import { formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		message,
	}: {
		message: RuntimeChatMessage;
	} = $props();
</script>

<section
	class={cn(
		'grid gap-2 px-4 py-3',
		message.role === 'assistant' ? 'justify-items-start' : 'justify-items-end',
	)}
	data-testid={`runtime-heartbeat-message-${message.id}`}
>
	<div class="flex max-w-[min(52rem,100%)] flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
		<Badge variant="outline">{message.role}</Badge>
		{#if message.channel}
			<Badge variant="secondary">{message.channel}</Badge>
		{/if}
		<span>{formatRuntimeTimestamp(message.timestamp)}</span>
	</div>

	<div
		class={cn(
			'max-w-[min(52rem,100%)] rounded-3xl border px-4 py-3 text-sm leading-7 shadow-sm',
			message.role === 'assistant' ? 'border-border/70 bg-card' : 'border-primary/25 bg-primary/8',
		)}
	>
		<div class="whitespace-pre-wrap break-words">{message.content}</div>

		{#if message.attachments?.length}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each message.attachments as attachment (attachment.assetId)}
					<Badge variant="outline">{attachment.name}</Badge>
				{/each}
			</div>
		{/if}

		{#if message.tool}
			<div class="mt-3 rounded-2xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
				{message.tool.name} · {message.tool.status}
			</div>
		{/if}
	</div>
</section>
