<script lang="ts">
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Button } from '$lib/components/ui/button/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import {
		resolveTerminalIdentitySubtitle,
		resolveTerminalInstanceName,
		resolveTerminalLifecycleFacts,
	} from './terminal-display';

	const controller = getAppControllerContext();

	const archivedTerminals = $derived(controller.runtimeState.globalTerminalArchive.data);
	const archiveLoaded = $derived(controller.runtimeState.globalTerminalArchive.loaded);
	const archiveLoading = $derived(controller.runtimeState.globalTerminalArchive.loading);
	const archiveError = $derived(controller.runtimeState.globalTerminalArchive.error);
</script>

<WorkbenchScaffold
	tone="page"
	body="scroll"
	contentClass="divide-y px-0 py-0"
	data-testid="terminal-archive-route"
>
	{#snippet header()}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="grid gap-1">
				<div class="flex items-center gap-2">
					<ArchiveIcon class="size-4 text-muted-foreground" />
					<h1 class="text-base font-semibold">Terminal archive</h1>
				</div>
				<p class="text-sm text-muted-foreground">
					Archived terminals are retained evidence that no longer appear in the default history queue.
				</p>
			</div>
			<div class="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
				{archivedTerminals.length} archived
			</div>
		</div>
	{/snippet}

	{#if archiveError}
		<div class="px-5 pt-4 md:px-7">
			<NoticeBanner tone="destructive" message={archiveError} />
		</div>
	{:else if !archiveLoaded && archiveLoading}
		<div class="px-5 py-6 text-sm text-muted-foreground md:px-7">Loading terminal archive…</div>
	{:else if archivedTerminals.length === 0}
		<div class="px-5 py-6 text-sm text-muted-foreground md:px-7">
			No archived terminals are currently retained.
		</div>
	{:else}
		{#each archivedTerminals as terminal (terminal.terminalId)}
			<div class="grid gap-3 px-5 py-4 md:px-7">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0 grid gap-1">
						<div class="truncate text-sm font-semibold">{resolveTerminalInstanceName(terminal)}</div>
						<div class="truncate text-[11px] text-muted-foreground">
							{resolveTerminalIdentitySubtitle(terminal) || terminal.terminalId}
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						{#each resolveTerminalLifecycleFacts(terminal) as fact (fact.key)}
							<div class="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
								{fact.label}
							</div>
						{/each}
					</div>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button
						size="sm"
						variant="outline"
						onclick={() => void goto(`/terminals/${encodeURIComponent(terminal.terminalId)}`, {
							noScroll: true,
							keepFocus: true,
						})}
					>
						Open detail
					</Button>
				</div>
			</div>
		{/each}
	{/if}
</WorkbenchScaffold>
