<script lang="ts">
	import { cn } from '$lib/utils.js';

	import { ReasoningContext, setReasoningContext } from './reasoning-context.svelte.js';

	let {
		class: className = '',
		isStreaming = false,
		open = $bindable<boolean | undefined>(undefined),
		defaultOpen = false,
		children,
		...restProps
	}: {
		class?: string;
		isStreaming?: boolean;
		open?: boolean;
		defaultOpen?: boolean;
		children?: import('svelte').Snippet;
	} = $props();

	let internalOpen = $state(false);
	const context = new ReasoningContext();
	setReasoningContext(context);

	$effect(() => {
		internalOpen = open ?? defaultOpen;
	});

	$effect(() => {
		context.isStreaming = isStreaming;
	});

	$effect(() => {
		context.isOpen = internalOpen;
	});

	$effect(() => {
		if (open !== undefined) {
			internalOpen = open;
		}
	});

	$effect(() => {
		if (isStreaming && open === undefined) {
			internalOpen = true;
		}
	});
</script>

<details class={cn('grid gap-2', className)} bind:open={internalOpen} {...restProps}>
	{@render children?.()}
</details>
