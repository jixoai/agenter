<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { cn } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		title = 'Toggle application navigation',
		'aria-label': ariaLabel = title,
		...restProps
	}: ComponentProps<typeof Sidebar.Trigger> = $props();
</script>

<Sidebar.Trigger
	class={cn(
		'size-8 rounded-xl border border-border/65 bg-background/80 text-muted-foreground shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_72%),0_14px_24px_-20px_color-mix(in_srgb,var(--foreground),transparent_18%)] transition-[background-color,color,border-color,box-shadow] hover:bg-background hover:text-foreground',
		className,
	)}
	title={title}
	aria-label={ariaLabel}
	{...restProps}
/>
