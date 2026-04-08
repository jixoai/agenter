<script lang="ts">
	import { cn } from '$lib/utils.js';

	let {
		value = $bindable(''),
		readOnly = false,
		placeholder = '',
		onValueChange,
		class: className,
		testId,
	}: {
		value?: string;
		readOnly?: boolean;
		placeholder?: string;
		onValueChange?: (value: string) => void;
		class?: string;
		testId?: string;
	} = $props();
</script>

<div
	data-testid={testId}
	class={cn('h-full min-w-0 rounded-md border border-border/70 bg-background shadow-xs', className)}
>
	<textarea
		bind:value
		readonly={readOnly}
		placeholder={placeholder}
		class="h-full min-h-[22rem] w-full resize-none bg-transparent p-3 font-mono text-xs leading-6 outline-none"
		oninput={(event) => onValueChange?.(event.currentTarget.value)}
	></textarea>
</div>
