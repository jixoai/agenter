<script lang="ts">
	import type { RuntimeSnapshotEntry, SessionEntry } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	let {
		session,
		runtime,
	}: {
		session: SessionEntry;
		runtime: RuntimeSnapshotEntry | null;
	} = $props();

	const capabilityEntries = $derived(
		Object.entries(runtime?.modelCapabilities ?? {}).map(([key, value]) => ({
			key,
			enabled: Boolean(value),
		})),
	);
</script>

<div class="grid auto-rows-max gap-4" data-testid="runtime-settings-stage">
	<div class="grid gap-4 xl:grid-cols-2">
		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Runtime identity</Card.Title>
				<Card.Description>Session identity and workspace binding stay explicit so runtime routes remain orthogonal to settings editors.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Avatar</div>
					<div class="mt-2 text-sm font-semibold">{session.avatar || session.name}</div>
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Session id</div>
					<div class="mt-2 break-all text-sm font-semibold">{session.id}</div>
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workspace path</div>
					<div class="mt-2 break-all text-sm font-semibold">{session.workspacePath}</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Runtime capabilities</Card.Title>
				<Card.Description>Capabilities reflect what the current model/runtime profile can do without reopening the full settings editor.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				{#if capabilityEntries.length === 0}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
						No runtime capability snapshot is available yet.
					</div>
				{:else}
					<div class="flex flex-wrap gap-2">
						{#each capabilityEntries as entry (entry.key)}
							<Badge variant={entry.enabled ? 'secondary' : 'outline'}>
								{entry.key}
							</Badge>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
