<script lang="ts" module>
	import type { ButtonProps } from '$lib/components/ui/button/index.js';

	export interface ConversationScrollButtonProps extends ButtonProps {}
</script>

<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';

	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	import { getStickToBottomContext } from './stick-to-bottom-context.svelte.js';

	let { class: className = '', onclick, ...restProps }: ConversationScrollButtonProps = $props();

	const context = getStickToBottomContext();

	const handleClick = (event: MouseEvent): void => {
		context.scrollToBottom('auto');
		onclick?.(
			event as MouseEvent & {
				currentTarget: EventTarget & HTMLButtonElement;
			},
		);
	};
</script>

<div
	class="conversation-scroll-button pointer-events-none absolute inset-x-0 bottom-4 flex justify-center"
	data-visible={!context.isAtBottom}
>
	<Button
		class={cn(
			'pointer-events-auto rounded-full border border-border/70 bg-background/85 shadow-lg backdrop-blur-sm transition-opacity',
			className,
		)}
		size="icon"
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

	@supports (animation-timeline: scroll()) {
		.conversation-scroll-button {
			animation-name: conversation-scroll-button-reveal;
			animation-duration: 1s;
			animation-fill-mode: both;
			animation-timeline: --conversation-scroll;
			animation-range: 0 120px;
		}
	}

	@keyframes conversation-scroll-button-reveal {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
