<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { MessageFrom } from './message.types.js';

	import { cn } from '$lib/utils.js';

	type MessageProps = HTMLAttributes<HTMLDivElement> & {
		from: MessageFrom;
	};

	let { class: className = '', from, children, ...restProps }: MessageProps = $props();
</script>

<div
	class={cn(
		'group/message flex w-full items-end gap-3 py-2',
		from === 'user' ? 'flex-row-reverse justify-end' : 'justify-start',
		className,
	)}
	data-message-from={from}
	{...restProps}
>
	{@render children?.()}
</div>
