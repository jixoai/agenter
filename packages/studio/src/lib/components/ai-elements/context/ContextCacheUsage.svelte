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

	let cacheTokens = $derived.by(() => context.usage?.cachedInputTokens ?? 0);
</script>

{#if children}
	{@render children?.()}
{:else if cacheTokens}
	<div class={cn("flex items-center justify-between text-xs", className)} {...props}>
		<span class="text-muted-foreground">Cache</span>
		<TokensWithCost tokens={cacheTokens} />
	</div>
{/if}
