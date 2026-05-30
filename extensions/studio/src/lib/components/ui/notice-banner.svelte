<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CircleCheckBigIcon from '@lucide/svelte/icons/circle-check-big';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	import * as Alert from '$lib/components/ui/alert/index.js';
	import { cn } from '$lib/utils.js';

	type NoticeTone = 'default' | 'info' | 'warning' | 'destructive' | 'success';

	let {
		tone = 'info',
		title = '',
		message,
		class: className = '',
	}: {
		tone?: NoticeTone;
		title?: string;
		message: string;
		class?: string;
	} = $props();

	const toneClassName = $derived.by(() => {
		switch (tone) {
			case 'destructive':
				return 'border-destructive/30 bg-destructive/5 text-destructive';
			case 'warning':
				return 'border-amber-300/70 bg-amber-50 text-amber-950';
			case 'success':
				return 'border-emerald-300/70 bg-emerald-50 text-emerald-950';
			default:
				return 'border-border bg-muted/40 text-foreground';
		}
	});

	const alertVariant = $derived(tone === 'destructive' ? 'destructive' : 'default');
</script>

<Alert.Alert variant={alertVariant} class={cn('grid-cols-[auto_1fr]', toneClassName, className)}>
	{#if tone === 'destructive'}
		<CircleXIcon class="size-4" />
	{:else if tone === 'warning'}
		<TriangleAlertIcon class="size-4" />
	{:else if tone === 'success'}
		<CircleCheckBigIcon class="size-4" />
	{:else}
		<CircleAlertIcon class="size-4" />
	{/if}

	<div class="min-w-0">
		{#if title}
			<Alert.AlertTitle>{title}</Alert.AlertTitle>
		{/if}
		<Alert.AlertDescription>{message}</Alert.AlertDescription>
	</div>
</Alert.Alert>
