<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { type VariantProps, tv } from 'tailwind-variants';

	import type { MessageFrom } from './Message.svelte';

	const messageContentVariants = tv({
		base: 'grid gap-3 overflow-hidden text-sm',
		variants: {
			variant: {
				contained: 'max-w-[min(46rem,92%)] rounded-[1.4rem] border px-4 py-3 shadow-sm',
				flat: 'w-full max-w-[min(58rem,100%)] rounded-[1.25rem] border px-4 py-3 shadow-sm',
			},
			from: {
				user: 'border-primary/10 bg-primary text-primary-foreground',
				assistant: 'border-border/70 bg-card/85 text-foreground',
			},
		},
		defaultVariants: {
			variant: 'contained',
			from: 'assistant',
		},
	});

	export type MessageContentProps = WithElementRef<HTMLAttributes<HTMLDivElement>> &
		VariantProps<typeof messageContentVariants> & {
			from?: MessageFrom;
		};
</script>

<script lang="ts">
	let { class: className = '', variant, from = 'assistant', children, ref = $bindable(null), ...restProps }: MessageContentProps =
		$props();
</script>

<div
	bind:this={ref}
	class={cn(messageContentVariants({ variant, from }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
