<script lang="ts">
	import { cn } from '$lib/utils.js';

	let {
		class: className = '',
		children,
		framed = true,
		open = $bindable(false),
		...restProps
	}: {
		class?: string;
		children?: import('svelte').Snippet;
		framed?: boolean;
		open?: boolean;
	} = $props();
</script>

<details
	class={cn(
		'min-w-0 w-full max-w-full',
		framed ? 'rounded-xl border border-border/50 bg-background/55' : 'border-0 bg-transparent',
		className,
	)}
	bind:open
	{...restProps}
>
	{@render children?.()}
</details>
