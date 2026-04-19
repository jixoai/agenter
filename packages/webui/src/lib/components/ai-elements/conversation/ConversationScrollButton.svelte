<script lang="ts" module>
	import type { ButtonProps } from '$lib/components/ui/button/index.js';

	export interface ConversationScrollButtonProps extends ButtonProps {
		visible?: boolean;
		buttonRef?: HTMLButtonElement | null;
		onScrollToLatest?: (() => void) | undefined;
	}
</script>

<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';

	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	let {
		class: className = '',
		visible = false,
		buttonRef = $bindable<HTMLButtonElement | null>(null),
		onScrollToLatest = undefined,
		onclick,
		...restProps
	}: ConversationScrollButtonProps = $props();

	const handleClick = (event: MouseEvent): void => {
		onScrollToLatest?.();
		onclick?.(
			event as MouseEvent & {
				currentTarget: EventTarget & HTMLButtonElement;
			},
		);
	};
</script>

<div
	class="conversation-scroll-button pointer-events-none absolute inset-x-0 bottom-4 flex justify-center"
	data-visible={visible}
>
	<Button
		bind:ref={buttonRef}
		aria-hidden={!visible}
		class={cn(
			'pointer-events-auto rounded-full border border-border/70 bg-background/85 shadow-lg backdrop-blur-sm transition-opacity',
			className,
		)}
		size="icon"
		tabindex={visible ? undefined : -1}
		variant="outline"
		type="button"
		onclick={handleClick}
		{...restProps}
	>
		<ArrowDown class="size-4" />
	</Button>
</div>

<style>
	.conversation-scroll-button {
		z-index: 20;
		opacity: 0;
		transform: translateY(8px);
		transition:
			opacity 160ms ease,
			transform 160ms ease;
	}

	.conversation-scroll-button[data-visible='true'] {
		opacity: 1;
		transform: translateY(0);
	}
</style>
