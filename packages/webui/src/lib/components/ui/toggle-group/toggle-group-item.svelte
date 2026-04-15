<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';

	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		value,
		disabled = false,
		class: className,
		children,
	}: {
		ref?: HTMLButtonElement | null;
		value: string;
		disabled?: boolean;
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<ToggleGroupPrimitive.Item
	bind:ref
	{value}
	{disabled}
	data-slot="toggle-group-item"
	class={cn(
		'inline-flex h-6 min-w-0 items-center justify-center rounded-full px-2.5 text-[11px] font-medium text-muted-foreground transition-colors outline-none data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm disabled:pointer-events-none disabled:opacity-50',
		className,
	)}
>
	{@render children?.()}
</ToggleGroupPrimitive.Item>
