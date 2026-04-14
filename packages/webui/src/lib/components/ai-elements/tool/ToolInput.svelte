<script lang="ts">
	import JSONViewer from '$lib/components/web-components/json-viewer.svelte';
	import { cn } from '$lib/utils.js';

	let { class: className = '', input }: { class?: string; input: unknown } = $props();

	const hasMeaningfulInput = $derived(
		input !== null &&
			input !== undefined &&
			(typeof input !== 'string' || input.trim().length > 0),
	);
</script>

{#if hasMeaningfulInput}
	<div class={cn('grid gap-2 px-3 pb-3', className)}>
		<div class="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Parameters</div>
		<JSONViewer
			value={input}
			rawText={JSON.stringify(input, null, 2)}
			class="rounded-xl border border-border/60 bg-background px-3 py-3"
		/>
	</div>
{/if}
