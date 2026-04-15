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

<summary class={cn('flex cursor-pointer list-none items-start justify-between gap-2 px-2.5 py-2 text-left', className)}>
	<div class="flex min-w-0 items-start gap-2">
		<div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
			<Wrench class="size-3.5" />
		</div>
		<div class="grid min-w-0 gap-0.5">
			<div class="flex min-w-0 flex-wrap items-center gap-1.5">
				<span class="truncate text-[13px] font-medium">{type}</span>
				<Badge class="gap-1 rounded-full px-1.5 py-0 text-[10px]" variant="secondary">
					{@const StatusIcon = status.icon}
					<StatusIcon
						class={cn(
							'size-3',
							state === 'input-available' ? 'animate-pulse' : '',
							state === 'output-available' ? 'text-emerald-600' : '',
							state === 'output-error' ? 'text-destructive' : '',
						)}
					/>
					{status.label}
				</Badge>
			</div>
			{#if preview}
				<div class="truncate font-mono text-[11px] text-muted-foreground">{preview}</div>
			{/if}
		</div>
	</div>
	<ChevronDown class="mt-1 size-4 shrink-0 text-muted-foreground" />
</summary>
