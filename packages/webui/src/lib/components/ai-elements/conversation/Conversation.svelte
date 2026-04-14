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
	import { setStickToBottomContext } from './stick-to-bottom-context.svelte.js';

	let {
		class: className = '',
		children,
		initial = 'auto',
		resize = 'smooth',
		ref = $bindable(null),
		...restProps
	}: ConversationProps = $props();

	const context = setStickToBottomContext();

	$effect(() => {
		context.configure({ initial, resize });
	});
</script>

<div
	bind:this={ref}
	class={cn('relative flex h-full flex-col overflow-hidden', className)}
	role="log"
	{...restProps}
>
	{@render children?.()}
</div>
