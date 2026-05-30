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

	let reasoningTokens = $derived.by(() => context.usage?.reasoningTokens ?? 0);
</script>

{#if children}
	{@render children()}
{:else if reasoningTokens}
	<div class={cn("flex items-center justify-between text-xs", className)} {...props}>
		<span class="text-muted-foreground">Reasoning</span>
		<TokensWithCost tokens={reasoningTokens} />
	</div>
{/if}
