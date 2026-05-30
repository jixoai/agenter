<script lang="ts">
	import type { RuntimeChatMessage } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';

	import { formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		message,
	}: {
		message: RuntimeChatMessage;
	} = $props();

	const compactTriggerLabel = $derived.by(() => {
		switch (message.compactTrigger) {
			case 'manual':
				return 'Manual';
			case 'threshold':
				return 'Threshold';
			case 'context_overflow':
				return 'Context overflow';
			case 'external_continuation_limit':
				return 'Continuation limit';
			case 'timeout':
				return 'Timeout';
			case 'error':
				return 'Legacy error';
			case 'attention_retry':
				return 'Attention retry';
			default:
				return null;
		}
	});
</script>

<section
	class="grid justify-items-center px-4 py-3"
	data-testid={`runtime-heartbeat-compact-separator-${message.id}`}
>
	<div class="grid max-w-2xl justify-items-center gap-2 rounded-2xl border border-dashed bg-muted/35 px-4 py-3 text-center">
		<div class="flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
			<Badge variant="outline">Context compacted</Badge>
			{#if compactTriggerLabel}
				<Badge variant="secondary">{compactTriggerLabel}</Badge>
			{/if}
			<span>{formatRuntimeTimestamp(message.timestamp)}</span>
		</div>

		<div class="text-sm leading-6 text-muted-foreground">
			{message.content}
		</div>
	</div>
</section>
