<script lang="ts">
	import { cn } from '$lib/utils.js';

	let {
		class: className = '',
		children,
		open = $bindable(false),
		...restProps
	}: {
		class?: string;
		children?: import('svelte').Snippet;
		open?: boolean;
	} = $props();
</script>

<details class={cn('w-full rounded-2xl border border-border/60 bg-background/70', className)} bind:open {...restProps}>
	{@render children?.()}
</details>
