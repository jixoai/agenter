<script lang="ts">
	import MarkdownDocument from '$lib/components/web-components/markdown-document.svelte';
	import JSONViewer from '$lib/components/web-components/json-viewer.svelte';
	import { cn } from '$lib/utils.js';

	let {
		class: className = '',
		output,
		errorText,
		plain = false,
	}: {
		class?: string;
		output?: unknown;
		errorText?: string | null;
		plain?: boolean;
	} = $props();
</script>

{#if output !== undefined || errorText}
	<div class={cn('grid min-w-0 gap-1.5 px-2.5 pb-2', className)}>
		<div class="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
			{errorText ? 'Error' : 'Result'}
		</div>
		{#if errorText}
			<div class="rounded-lg bg-destructive/10 px-2.5 py-2 text-sm text-destructive">
				{errorText}
			</div>
		{:else if typeof output === 'string'}
			<MarkdownDocument
				value={output}
				mode="preview"
				usage="chat"
				padding="compact"
				class="min-w-0 rounded-lg bg-background/70 px-2.5 py-2"
			/>
		{:else}
			<JSONViewer
				value={output}
				rawText={JSON.stringify(output, null, 2)}
				{plain}
				class="min-w-0 w-full max-w-full rounded-lg bg-background/70 px-2.5 py-2"
			/>
		{/if}
	</div>
{/if}
