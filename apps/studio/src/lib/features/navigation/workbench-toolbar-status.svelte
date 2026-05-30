<script lang="ts">
	import { cn } from '$lib/utils.js';

	import type { WorkbenchToolbarPlacement } from './workbench-toolbar.types';

	type WorkbenchToolbarStatusTone = 'neutral' | 'accent' | 'positive' | 'warning' | 'critical';

	let {
		placement,
		label,
		title = label,
		tone = 'neutral',
		caps = false,
		class: className,
	}: {
		placement: WorkbenchToolbarPlacement;
		label: string;
		title?: string;
		tone?: WorkbenchToolbarStatusTone;
		caps?: boolean;
		class?: string;
	} = $props();

	const toneClass = $derived.by(() => {
		switch (tone) {
			case 'accent':
				return 'border-border/60 bg-muted/58 text-foreground';
			case 'positive':
				return 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300';
			case 'warning':
				return 'border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-300';
			case 'critical':
				return 'border-destructive/24 bg-destructive/8 text-destructive';
			default:
				return 'border-border/55 bg-background/72 text-muted-foreground';
		}
	});

	const sizeClass = $derived.by(() => {
		if (placement === 'overflow') {
			return caps ? 'h-6 px-2.5 text-[10px]' : 'h-6 px-2.5 text-[11px]';
		}
		return caps ? 'h-4 px-1.25 text-[7px]' : 'h-4 px-1.25 text-[8px]';
	});

	const trackingClass = $derived(caps ? 'uppercase tracking-[0.08em]' : 'tracking-[0.02em]');
</script>

<span
	class={cn(
		'workbench-toolbar-status-pill inline-flex min-w-0 items-center rounded-full border font-medium leading-none shadow-none',
		sizeClass,
		trackingClass,
		toneClass,
		className,
	)}
	title={title}
	data-workbench-toolbar-status
	data-workbench-toolbar-status-placement={placement}
	data-workbench-toolbar-status-tone={tone}
>
	<span class="truncate">{label}</span>
</span>

<style>
	.workbench-toolbar-status-pill {
		font-family: var(--font-nav, var(--font-sans));
	}
</style>
