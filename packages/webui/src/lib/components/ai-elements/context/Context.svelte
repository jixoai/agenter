<script lang="ts">
	import * as HoverCard from "$lib/components/ui/hover-card/index.js";
	import { ContextClass, setContextValue, type ContextSchema } from "./context-context.svelte.js";

	interface Props extends ContextSchema {
		children?: import("svelte").Snippet;
		// HoverCard props
		closeDelay?: number;
		openDelay?: number;
		[key: string]: any;
	}

	let {
		usedTokens,
		maxTokens,
		usage,
		modelId,
		estimatedCostLabel = null,
		children,
		closeDelay = 0,
		openDelay = 0,
		...props
	}: Props = $props();

	const contextInstance = new ContextClass({
		usedTokens: 0,
		maxTokens: 0,
		usage: undefined,
		modelId: undefined,
		estimatedCostLabel: null,
	});

	// Update context when props change
	$effect(() => {
		contextInstance.usedTokens = usedTokens;
		contextInstance.maxTokens = maxTokens;
		contextInstance.usage = usage;
		contextInstance.modelId = modelId;
		contextInstance.estimatedCostLabel = estimatedCostLabel;
	});

	setContextValue(contextInstance);
</script>

<HoverCard.Root {openDelay} {closeDelay} {...props}>
	{@render children?.()}
</HoverCard.Root>
