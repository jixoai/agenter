<script lang="ts">
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Circle from '@lucide/svelte/icons/circle';
	import Clock from '@lucide/svelte/icons/clock';
	import Wrench from '@lucide/svelte/icons/wrench';
	import XCircle from '@lucide/svelte/icons/x-circle';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	export type ToolUiState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error';

	let {
		type,
		state,
		preview = null,
		class: className = '',
	}: {
		type: string;
		state: ToolUiState;
		preview?: string | null;
		class?: string;
	} = $props();

	const status = $derived.by(() => {
		switch (state) {
			case 'input-streaming':
				return { icon: Circle, label: 'Pending' };
			case 'input-available':
				return { icon: Clock, label: 'Running' };
			case 'output-error':
				return { icon: XCircle, label: 'Error' };
			default:
				return { icon: CheckCircle, label: 'Completed' };
		}
	});
</script>

<summary class={cn('flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-left', className)}>
	<div class="grid min-w-0 gap-1">
		<div class="flex min-w-0 items-center gap-2">
			<Wrench class="size-4 shrink-0 text-muted-foreground" />
			<span class="truncate text-sm font-medium">{type}</span>
			<Badge class="gap-1.5 rounded-full text-[11px]" variant="secondary">
				{@const StatusIcon = status.icon}
				<StatusIcon
					class={cn(
						'size-3.5',
						state === 'input-available' ? 'animate-pulse' : '',
						state === 'output-available' ? 'text-emerald-600' : '',
						state === 'output-error' ? 'text-destructive' : '',
					)}
				/>
				{status.label}
			</Badge>
		</div>
		{#if preview}
			<div class="truncate font-mono text-xs text-muted-foreground">{preview}</div>
		{/if}
	</div>
	<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
</summary>
