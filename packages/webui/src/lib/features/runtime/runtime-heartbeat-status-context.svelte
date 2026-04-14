<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	import type { RuntimeHeartbeatContextState } from './runtime-heartbeat-statusbar-state';

	let {
		state,
		class: className = '',
	}: {
		state: RuntimeHeartbeatContextState;
		class?: string;
	} = $props();
</script>

{#if state.kind !== 'absent'}
	<div
		class={cn(
			'inline-flex min-w-0 items-center gap-2 rounded-full border border-border/60 bg-background/75 px-3 py-1.5',
			state.kind === 'unavailable' ? 'opacity-60' : '',
			className,
		)}
		data-testid="runtime-heartbeat-context"
		data-context-state={state.kind}
	>
		<Badge variant="outline" class="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
			Context
		</Badge>
		{#if state.kind === 'available'}
			<div class="flex min-w-0 items-center gap-2 truncate font-mono text-[11px]">
				<span>P {state.promptTokens}</span>
				<span>C {state.completionTokens}</span>
				<span>T {state.totalTokens}</span>
			</div>
		{:else}
			<div class="truncate text-xs text-muted-foreground">Latest usage unavailable</div>
		{/if}
	</div>
{/if}
