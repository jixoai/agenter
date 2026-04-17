<script lang="ts">
	import { cn } from "$lib/utils";
	import { getContextValue } from "./context-context.svelte.js";
	import TokensWithCost from "./TokensWithCost.svelte";

	interface Props {
		children?: import("svelte").Snippet;
		class?: string;
		[key: string]: any;
	}

	let { children, class: className, ...props }: Props = $props();

	let context = getContextValue();

	let outputTokens = $derived.by(() => context.usage?.outputTokens ?? 0);
</script>

{#if children}
	{@render children()}
{:else if outputTokens}
	<div class={cn("flex items-center justify-between text-xs", className)} {...props}>
		<span class="text-muted-foreground">Output</span>
		<TokensWithCost tokens={outputTokens} />
	</div>
{/if}
