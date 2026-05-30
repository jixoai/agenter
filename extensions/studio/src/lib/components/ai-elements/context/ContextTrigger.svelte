<script lang="ts">
	import { cn } from "$lib/utils";
	import { Button } from "$lib/components/ui/button/index.js";
	import { buttonVariants } from "$lib/components/ui/button/button.variants.js";
	import HoverCardTrigger from "$lib/components/ui/hover-card/hover-card-trigger.svelte";
	import ContextIcon from "./ContextIcon.svelte";
	import { getContextValue } from "./context-context.svelte.js";

	interface Props {
		children?: import("svelte").Snippet;
		variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
		size?: "default" | "sm" | "lg" | "icon";
		disabled?: boolean;
		[key: string]: any;
	}

	let { children, variant = "ghost", size = "default", disabled = false, class: className = "", ...props }: Props =
		$props();

	const context = getContextValue();
	const triggerLabel = $derived(
		context.hasProgressMeter ? context.displayPercent : Number.isFinite(context.usedTokens) ? context.usedTokensFormatted : "—",
	);
</script>

{#snippet triggerContent()}
	{#if children}
		{@render children()}
	{:else}
		<span class="text-muted-foreground font-medium">
			{triggerLabel}
		</span>
		<ContextIcon />
	{/if}
{/snippet}

{#if disabled}
	<Button
		{variant}
		{size}
		{disabled}
		class={className}
		{...props}
	>
		{@render triggerContent()}
	</Button>
{:else}
	<HoverCardTrigger
		class={cn(buttonVariants({ variant, size }), className)}
		data-slot="button"
		{...props}
	>
		{@render triggerContent()}
	</HoverCardTrigger>
{/if}
