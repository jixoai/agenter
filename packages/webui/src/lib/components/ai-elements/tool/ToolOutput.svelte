<script lang="ts">
	import MarkdownDocument from '$lib/components/web-components/markdown-document.svelte';
	import JSONViewer from '$lib/components/web-components/json-viewer.svelte';
	import { cn } from '$lib/utils.js';

	let {
		class: className = '',
		output,
		errorText,
	}: {
		class?: string;
		output?: unknown;
		errorText?: string | null;
	} = $props();
</script>

{#if output !== undefined || errorText}
	<div class={cn('grid gap-2 px-3 pb-3', className)}>
		<div class="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
			{errorText ? 'Error' : 'Result'}
		</div>
		{#if errorText}
			<div class="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
				{errorText}
			</div>
		{:else if typeof output === 'string'}
			<MarkdownDocument
				value={output}
				mode="preview"
				usage="chat"
				padding="compact"
				class="rounded-xl border border-border/60 bg-background px-3 py-3"
			/>
		{:else}
			<JSONViewer
				value={output}
				rawText={JSON.stringify(output, null, 2)}
				class="rounded-xl border border-border/60 bg-background px-3 py-3"
			/>
		{/if}
	</div>
{/if}
