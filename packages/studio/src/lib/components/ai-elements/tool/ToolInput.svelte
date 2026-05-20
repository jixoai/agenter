<script lang="ts">
	import JSONViewer from '$lib/components/web-components/json-viewer.svelte';
	import { cn } from '$lib/utils.js';

	let {
		class: className = '',
		input,
		plain = false,
	}: {
		class?: string;
		input: unknown;
		plain?: boolean;
	} = $props();

	const hasMeaningfulInput = $derived(
		input !== null &&
			input !== undefined &&
			(typeof input !== 'string' || input.trim().length > 0),
	);
</script>

{#if hasMeaningfulInput}
	<div class={cn('grid min-w-0 gap-1.5 px-2.5 pb-2', className)}>
		<div class="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Parameters</div>
		<JSONViewer
			value={input}
			rawText={JSON.stringify(input, null, 2)}
			{plain}
			class="min-w-0 w-full max-w-full rounded-lg bg-background/70 px-2.5 py-2"
		/>
	</div>
{/if}
