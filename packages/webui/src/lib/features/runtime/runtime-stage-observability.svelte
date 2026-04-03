<script lang="ts">
	import type { RuntimeChatCycle, RuntimeSnapshotEntry, SessionEntry } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import { formatCycleLabel, formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		session,
		runtime,
		latestCycle,
	}: {
		session: SessionEntry;
		runtime: RuntimeSnapshotEntry | null;
		latestCycle: RuntimeChatCycle | null;
	} = $props();

	const schedulerState = $derived(runtime?.schedulerState ?? null);
</script>

<div class="grid auto-rows-max gap-4" data-testid="runtime-observability-stage">
	<div class="grid gap-3 md:grid-cols-3">
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Runtime status</div>
			<div class="mt-2 text-sm font-semibold">{schedulerState?.runtimeStatus ?? 'waiting_input'}</div>
		</div>
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Gate</div>
			<div class="mt-2 text-sm font-semibold">{schedulerState?.gate ?? 'idle'}</div>
		</div>
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Queue size</div>
			<div class="mt-2 text-sm font-semibold">{schedulerState?.queueSize ?? 0}</div>
		</div>
	</div>

	<div class="grid gap-4 xl:grid-cols-2">
		<Card.Root>
			<Card.Header class="border-b">
				<Card.Action>
					<Badge variant="outline">{schedulerState?.phase ?? runtime?.schedulerPhase ?? 'idle'}</Badge>
				</Card.Action>
				<Card.Title>Scheduler containment</Card.Title>
				<Card.Description>Containment facts tell you whether the runtime is blocked, backing off, or waiting for fresh evidence.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Waiting reason</div>
					<div class="mt-2 text-sm font-semibold">{schedulerState?.waitingReason ?? 'None recorded'}</div>
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last progress</div>
					<div class="mt-2 text-sm font-semibold">{formatRuntimeTimestamp(schedulerState?.lastProgressAt)}</div>
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Blocked reason</div>
					<div class="mt-2 text-sm font-semibold">{schedulerState?.blockedReason ?? 'Not blocked'}</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Recent diagnostics</Card.Title>
				<Card.Description>These are the fastest runtime facts to inspect before going deeper into traces or API call tooling.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest cycle</div>
					<div class="mt-2 text-sm font-semibold">
						{latestCycle ? `Cycle ${formatCycleLabel(latestCycle.cycleId)}` : 'No cycles yet'}
					</div>
					{#if latestCycle}
						<div class="mt-1 text-xs text-muted-foreground">
							{latestCycle.kind} · {latestCycle.status} · {formatRuntimeTimestamp(latestCycle.createdAt)}
						</div>
					{/if}
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last runtime error</div>
					<div class="mt-2 break-all text-sm font-semibold">
						{schedulerState?.lastError ?? session.lastError ?? 'None'}
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
