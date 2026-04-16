<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Sparkles from '@lucide/svelte/icons/sparkles';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	import type { RuntimeHeartbeatConfigBinding, RuntimeHeartbeatConfigDraft } from './runtime-heartbeat-config-state';
	import type {
		RuntimeHeartbeatAttentionFocusSummary,
		RuntimeHeartbeatContextState,
		RuntimeHeartbeatStatusState,
	} from './runtime-heartbeat-statusbar-state';
	import RuntimeHeartbeatConfigPanel from './runtime-heartbeat-config-panel.svelte';
	import RuntimeHeartbeatStatusContext from './runtime-heartbeat-status-context.svelte';
	import RuntimeHeartbeatStatusShimmer from './runtime-heartbeat-status-shimmer.svelte';

	let {
		statusState,
		contextState,
		shimmerSummary,
		groupCount,
		groupCountVisible = true,
		compactPending = false,
		compactDisabled = false,
		configBinding,
		configLoading = false,
		configSaving = false,
		configError = null,
		onRequestCompact,
		onRefreshConfig,
		onSaveConfig,
	}: {
		statusState: RuntimeHeartbeatStatusState;
		contextState: RuntimeHeartbeatContextState;
		shimmerSummary: RuntimeHeartbeatAttentionFocusSummary;
		groupCount: number;
		groupCountVisible?: boolean;
		compactPending?: boolean;
		compactDisabled?: boolean;
		configBinding: RuntimeHeartbeatConfigBinding;
		configLoading?: boolean;
		configSaving?: boolean;
		configError?: string | null;
		onRequestCompact: () => void | Promise<void>;
		onRefreshConfig: () => void | Promise<void>;
		onSaveConfig: (draft: RuntimeHeartbeatConfigDraft) => void | Promise<void>;
	} = $props();
</script>

<footer
	class="grid gap-2 border-t border-border/60 bg-background/72 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
	data-testid="runtime-heartbeat-statusbar"
>
	<div class="min-w-0 md:justify-self-start">
		<RuntimeHeartbeatStatusShimmer status={statusState} summary={shimmerSummary} class="w-full md:w-auto" />
	</div>

	<div class="min-w-0 md:justify-self-center">
		<RuntimeHeartbeatStatusContext state={contextState} class="max-w-full" />
	</div>

	<div class="flex min-w-0 items-center justify-between gap-2 md:justify-self-end">
		{#if groupCountVisible}
			<Badge variant="outline" class="rounded-full bg-background/70">
				{groupCount} groups
			</Badge>
		{/if}
		<Button
			variant="outline"
			size="sm"
			class="rounded-full"
			disabled={compactDisabled || compactPending}
			onclick={() => void onRequestCompact()}
		>
			{#if compactPending}
				<LoaderCircle class="mr-1 size-4 animate-spin" />
				Compacting…
			{:else}
				<Sparkles class="mr-1 size-4" />
				Compact
			{/if}
		</Button>
		<RuntimeHeartbeatConfigPanel
			binding={configBinding}
			loading={configLoading}
			saving={configSaving}
			error={configError}
			onRefresh={onRefreshConfig}
			onSave={onSaveConfig}
		/>
	</div>
</footer>
