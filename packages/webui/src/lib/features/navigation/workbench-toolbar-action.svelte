<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Button, type ButtonVariant } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	import type { WorkbenchToolbarPlacement } from './workbench-toolbar.types';

	type WorkbenchToolbarActionInlineTone = 'neutral' | 'active' | 'critical';

	let {
		placement,
		label,
		title = label,
		type = 'button',
		disabled = false,
		inlineLabel = false,
		inlineTone = 'neutral',
		overflowVariant = 'outline',
		class: className,
		onclick,
		children,
	}: {
		placement: WorkbenchToolbarPlacement;
		label: string;
		title?: string;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		inlineLabel?: boolean;
		inlineTone?: WorkbenchToolbarActionInlineTone;
		overflowVariant?: ButtonVariant;
		class?: string;
		onclick?: ((event: MouseEvent) => void) | null;
		children?: Snippet;
	} = $props();

	const inlineToneClass = $derived.by(() => {
		if (inlineTone === 'active') {
			return 'bg-accent text-accent-foreground hover:bg-accent/85';
		}
		if (inlineTone === 'critical') {
			return 'bg-destructive/10 text-destructive hover:bg-destructive/16 hover:text-destructive';
		}
		return 'text-muted-foreground hover:bg-accent hover:text-foreground';
	});
</script>

<Button
	type={type}
	variant={placement === 'overflow' ? overflowVariant : 'ghost'}
	size="sm"
	class={cn(
		placement === 'overflow'
			? 'h-8 w-auto justify-start self-start justify-self-start rounded-full px-2.5 text-xs'
			: cn(
					'h-6 min-h-0 rounded-full px-0 py-0 text-[11px] leading-none shadow-none ring-0 transition-colors [&_svg]:size-3.5',
					inlineLabel ? 'gap-1 px-1.5 has-[>svg]:px-1.25' : 'size-6 min-w-6 gap-0',
					inlineToneClass,
				),
		className,
	)}
	aria-label={label}
	title={title}
	{disabled}
	{onclick}
	data-workbench-toolbar-action
	data-workbench-toolbar-action-placement={placement}
>
	{#if children}
		{@render children()}
	{/if}
	{#if placement === 'overflow' || inlineLabel}
		<span>{label}</span>
	{/if}
</Button>
