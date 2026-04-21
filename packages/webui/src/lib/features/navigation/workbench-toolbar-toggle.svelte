<script lang="ts">
	import type { Snippet } from 'svelte';

	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { cn } from '$lib/utils.js';

	import type { WorkbenchToolbarPlacement } from './workbench-toolbar.types';

	type WorkbenchToolbarToggleInlineTone = 'neutral' | 'active';

	let {
		placement,
		label,
		title = label,
		pressed = false,
		disabled = false,
		inlineTone = 'neutral',
		class: className,
		onPressedChange,
		children,
	}: {
		placement: WorkbenchToolbarPlacement;
		label: string;
		title?: string;
		pressed?: boolean;
		disabled?: boolean;
		inlineTone?: WorkbenchToolbarToggleInlineTone;
		class?: string;
		onPressedChange?: ((pressed: boolean) => void) | null;
		children?: Snippet;
	} = $props();

	let toggleValue = $state('');
	let lastEmittedPressed = $state(false);

	$effect(() => {
		const nextValue = pressed ? 'on' : '';
		if (toggleValue !== nextValue) {
			toggleValue = nextValue;
		}
		lastEmittedPressed = pressed;
	});

	$effect(() => {
		const nextPressed = toggleValue === 'on';
		if (nextPressed === lastEmittedPressed) {
			return;
		}
		lastEmittedPressed = nextPressed;
		onPressedChange?.(nextPressed);
	});

	const inlineToneClass = $derived.by(() => {
		if (inlineTone === 'active') {
			return 'text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:shadow-none';
		}
		return 'text-muted-foreground hover:bg-accent hover:text-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground data-[state=on]:shadow-none';
	});
</script>

<ToggleGroup.Root
	bind:value={toggleValue}
	ariaLabel={title}
	{disabled}
	class={cn(
		placement === 'overflow'
			? 'h-auto w-auto justify-self-start border-0 bg-transparent p-0 shadow-none'
			: 'h-auto border-0 bg-transparent p-0 shadow-none',
		className,
	)}
>
	<ToggleGroup.Item
		value="on"
		class={cn(
			placement === 'overflow'
				? 'h-8 w-auto justify-start self-start rounded-full border border-border/70 bg-background/82 px-2.5 text-xs text-muted-foreground shadow-none data-[state=on]:border-border data-[state=on]:bg-accent data-[state=on]:text-foreground'
				: 'h-6 min-h-0 gap-1 rounded-full px-1.5 text-[11px] leading-none shadow-none [&_svg]:size-3.5',
			placement === 'inline' && inlineToneClass,
		)}
	>
		{#if children}
			{@render children()}
		{/if}
		<span>{label}</span>
	</ToggleGroup.Item>
</ToggleGroup.Root>
