<script lang="ts">
	import type { RuntimeChatCycle, RuntimeSnapshotEntry, SessionEntry } from '@agenter/client-sdk';

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
	<div class="grid gap-4">
		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Scheduler containment</Card.Title>
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
