<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	export interface ConversationProps extends WithElementRef<HTMLAttributes<HTMLDivElement>> {
		children?: Snippet;
		initial?: ScrollBehavior;
		resize?: ScrollBehavior;
	}
</script>

<script lang="ts">
	let {
		class: className = '',
		children,
		initial = 'auto',
		resize = 'smooth',
		ref = $bindable(null),
		...restProps
	}: ConversationProps = $props();
</script>

<div
	bind:this={ref}
	class={cn('relative flex h-full flex-col overflow-hidden', className)}
	role="log"
	{...restProps}
>
	{@render children?.()}
</div>
