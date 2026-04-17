<script lang="ts">
	import { cn } from "$lib/utils";
	import { getContextValue } from "./context-context.svelte.js";

	interface Props {
		children?: import("svelte").Snippet;
		class?: string;
		[key: string]: any;
	}

	let { children, class: className, ...props }: Props = $props();

	let context = getContextValue();
</script>

<div
	class={cn("bg-secondary flex w-full items-center justify-between gap-3 p-3 text-xs", className)}
	{...props}
>
	{#if children}
		{@render children?.()}
	{:else}
		<span class="text-muted-foreground">Estimated cost</span>
		<span>{context.estimatedCostLabel ?? "Unavailable"}</span>
	{/if}
</div>
