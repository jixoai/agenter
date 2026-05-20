<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	export interface CheckpointProps extends WithElementRef<HTMLAttributes<HTMLDivElement>> {
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { Separator } from '$lib/components/ui/separator/index.js';

	let { class: className = '', children, ref = $bindable(null), ...restProps }: CheckpointProps = $props();
</script>

<div
	bind:this={ref}
	class={cn('text-muted-foreground flex items-center gap-3 px-1 py-2', className)}
	{...restProps}
>
	{@render children?.()}
	<Separator class="flex-1" />
</div>
