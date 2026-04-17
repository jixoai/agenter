<script lang="ts">
	import { formatTokenCount } from "./context-context.svelte.js";

	interface Props {
		tokens?: number;
		costText?: string;
	}

	let { tokens, costText }: Props = $props();

	let tokensFormatted = $derived.by(() => {
		return tokens === undefined ? "—" : formatTokenCount(tokens);
	});
</script>

<span>
	{tokensFormatted}
	{#if costText}
		<span class="text-muted-foreground ml-2">• {costText}</span>
	{/if}
</span>
