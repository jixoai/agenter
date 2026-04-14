<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	import type {
		RuntimeHeartbeatAttentionFocusSummary,
		RuntimeHeartbeatContextState,
	} from './runtime-heartbeat-statusbar-state';
	import RuntimeHeartbeatStatusContext from './runtime-heartbeat-status-context.svelte';
	import RuntimeHeartbeatStatusShimmer from './runtime-heartbeat-status-shimmer.svelte';

	let {
		contextState,
		shimmerSummary,
		entryCount,
		loadingOlder,
		hasMoreOlder,
		onLoadOlder,
	}: {
		contextState: RuntimeHeartbeatContextState;
		shimmerSummary: RuntimeHeartbeatAttentionFocusSummary;
		entryCount: number;
		loadingOlder: boolean;
		hasMoreOlder: boolean;
		onLoadOlder: () => void | Promise<void>;
	} = $props();
</script>

<footer
	class="grid gap-2 border-t border-border/60 bg-background/70 px-3 py-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
	data-testid="runtime-heartbeat-statusbar"
>
	<div class="min-w-0">
		<RuntimeHeartbeatStatusContext state={contextState} />
	</div>

	<div class="min-w-0 md:justify-self-center">
		<RuntimeHeartbeatStatusShimmer summary={shimmerSummary} />
	</div>

	<div class="flex min-w-0 items-center justify-end gap-2">
		<Badge variant="outline" class="rounded-full bg-background/70">
			{entryCount} rows
		</Badge>
		<Button
			variant="outline"
			size="sm"
			class="rounded-full"
			disabled={loadingOlder || !hasMoreOlder}
			onclick={() => void onLoadOlder()}
		>
			{loadingOlder ? 'Loading older…' : hasMoreOlder ? 'Load older' : 'History loaded'}
		</Button>
	</div>
</footer>
