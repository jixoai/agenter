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
		context.scrollToBottom();
		onclick?.(
			event as MouseEvent & {
				currentTarget: EventTarget & HTMLButtonElement;
			},
		);
	};
</script>

{#if !context.isAtBottom}
	<div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
		<Button
			class={cn(
				'pointer-events-auto rounded-full border border-border/70 bg-background/85 shadow-lg backdrop-blur-sm',
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
{/if}
