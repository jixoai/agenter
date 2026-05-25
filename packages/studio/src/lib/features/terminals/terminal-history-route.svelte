<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import type { GlobalTerminalEntry } from '@agenter/client-sdk';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Button } from '$lib/components/ui/button/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import WorkbenchSplitDetailHost from '$lib/features/navigation/workbench-split-detail-host.svelte';
	import {
		resolveTerminalIdentitySubtitle,
		resolveTerminalInstanceName,
		resolveTerminalLifecycleFacts,
		resolveTerminalTransportLabel,
	} from './terminal-display';

	const controller = getAppControllerContext();

	let busyByTerminalId = $state<Record<string, 'archive' | 'delete' | null>>({});
	let routeNotice = $state<{ tone: 'default' | 'warning' | 'destructive'; message: string } | null>(null);
	let selectedTerminalId = $state<string | null>(null);
	let detailCompact = $state(false);
	let detailOpen = $state(true);

	const historyTerminals = $derived(controller.runtimeState.globalTerminalHistory.data);
	const historyLoaded = $derived(controller.runtimeState.globalTerminalHistory.loaded);
	const historyLoading = $derived(controller.runtimeState.globalTerminalHistory.loading);
	const historyError = $derived(controller.runtimeState.globalTerminalHistory.error);
	const liveHistoryTerminals = $derived(historyTerminals.filter((terminal) => terminal.processPhase !== 'killed'));
	const killedHistoryTerminals = $derived(historyTerminals.filter((terminal) => terminal.processPhase === 'killed'));
	const selectedTerminal = $derived(
		historyTerminals.find((terminal) => terminal.terminalId === selectedTerminalId) ?? (historyTerminals[0] ?? null),
	);

	const describeTerminalHistoryError = (error: unknown, fallback: string) =>
		error instanceof Error ? error.message : fallback;

	const setBusy = (terminalId: string, phase: 'archive' | 'delete' | null): void => {
		busyByTerminalId = {
			...busyByTerminalId,
			[terminalId]: phase,
		};
	};

	const isBusy = (terminalId: string): boolean => Boolean(busyByTerminalId[terminalId]);
	const isKilledTerminal = (terminal: GlobalTerminalEntry): boolean => terminal.processPhase === 'killed';

	const selectTerminal = (terminalId: string): void => {
		selectedTerminalId = terminalId;
		detailOpen = true;
	};

	const openTerminalDetail = async (terminalId: string): Promise<void> => {
		await goto(`/terminals/${encodeURIComponent(terminalId)}`, {
			noScroll: true,
			keepFocus: true,
		});
	};

	const handleArchive = async (terminalId: string): Promise<void> => {
		setBusy(terminalId, 'archive');
		try {
			await controller.runtimeStore.archiveGlobalTerminal({ terminalId });
			routeNotice = null;
		} catch (error) {
			routeNotice = {
				tone: 'destructive',
				message: describeTerminalHistoryError(error, 'terminal archive failed'),
			};
		} finally {
			setBusy(terminalId, null);
		}
	};

	const handleDelete = async (terminalId: string): Promise<void> => {
		setBusy(terminalId, 'delete');
		try {
			await controller.runtimeStore.deleteGlobalTerminal({ terminalId });
			routeNotice = null;
		} catch (error) {
			routeNotice = {
				tone: 'destructive',
				message: describeTerminalHistoryError(error, 'terminal delete failed'),
			};
		} finally {
			setBusy(terminalId, null);
		}
	};

	const resolveTerminalDetailRows = (terminal: GlobalTerminalEntry) => [
		{ label: 'Terminal ID', value: terminal.terminalId },
		{ label: 'Phase', value: terminal.processPhase },
		{ label: 'Path', value: terminal.currentPath ?? terminal.launchCwd ?? 'No retained path' },
		{ label: 'Transport', value: resolveTerminalTransportLabel(terminal) },
		{ label: 'Stop reason', value: terminal.lastStopReason ?? 'none' },
	];
</script>

<WorkbenchScaffold
	tone="page"
	bodyClass="h-full p-2 md:p-3"
	data-testid="terminal-history-route"
>
	{#snippet header()}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div class="grid gap-0.5">
				<div class="flex items-center gap-2">
					<HistoryIcon class="size-4 text-muted-foreground" />
					<h1 class="text-sm font-semibold">Terminals</h1>
				</div>
				<p class="text-xs text-muted-foreground">
					Live terminals stay on top. Killed terminals remain available for archive or delete.
				</p>
			</div>
			<div class="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
				{historyTerminals.length} total
			</div>
		</div>
	{/snippet}

	{#if historyError}
		<NoticeBanner tone="destructive" message={historyError} />
	{:else if routeNotice}
		<NoticeBanner tone={routeNotice.tone} message={routeNotice.message} />
	{/if}

	{#if !historyLoaded && historyLoading}
		<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
			Loading terminal index…
		</div>
	{:else if historyTerminals.length === 0}
		<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
			No terminal instances are currently available.
		</div>
	{:else}
		<WorkbenchSplitDetailHost
			bind:detailCompact
			bind:detailOpen
			detailRatioPersistence="terminal-history:index"
			gridClass="h-full"
			mainClass="h-full"
			drawerClass="h-full"
			detailCloseLabel="Close terminal detail"
			detailSheetClass="w-[min(30rem,calc(100vw-1rem))] p-3"
		>
			{#snippet main()}
				<section class="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-lg border border-border/70 bg-background/50 p-1.5">
					<header class="mb-2 flex items-center justify-between gap-2 px-1">
						<div class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							Terminal queue
						</div>
						<div class="text-[10px] text-muted-foreground">
							{liveHistoryTerminals.length} live / {killedHistoryTerminals.length} killed
						</div>
					</header>

					<ScrollView
						class="h-full"
						viewportTestId="terminal-history-list-viewport"
						contentClass="grid gap-1.5 pr-1"
					>
						{#if liveHistoryTerminals.length > 0}
							<div class="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
								Live
							</div>
							{#each liveHistoryTerminals as terminal (terminal.terminalId)}
								<button
									type="button"
									class={`grid gap-0.5 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
										terminal.terminalId === selectedTerminal?.terminalId
											? 'border-primary/40 bg-primary/5'
											: 'border-border/70 bg-card hover:bg-muted/50'
									}`}
									onclick={() => selectTerminal(terminal.terminalId)}
								>
									<div class="flex items-center justify-between gap-2">
										<div class="min-w-0 truncate text-xs font-medium">{resolveTerminalInstanceName(terminal)}</div>
										<div class="rounded-full border px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
											{terminal.processPhase}
										</div>
									</div>
									<div class="truncate text-[10px] text-muted-foreground">
										{resolveTerminalIdentitySubtitle(terminal) || terminal.terminalId}
									</div>
								</button>
							{/each}
						{/if}

						{#if killedHistoryTerminals.length > 0}
							<div class="px-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
								Killed
							</div>
							{#each killedHistoryTerminals as terminal (terminal.terminalId)}
								<button
									type="button"
									class={`grid gap-0.5 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
										terminal.terminalId === selectedTerminal?.terminalId
											? 'border-primary/40 bg-primary/5'
											: 'border-border/70 bg-card hover:bg-muted/50'
									}`}
									onclick={() => selectTerminal(terminal.terminalId)}
								>
									<div class="flex items-center justify-between gap-2">
										<div class="min-w-0 truncate text-xs font-medium">{resolveTerminalInstanceName(terminal)}</div>
										<div class="rounded-full border px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
											{terminal.lastStopReason ?? 'killed'}
										</div>
									</div>
									<div class="truncate text-[10px] text-muted-foreground">
										{resolveTerminalIdentitySubtitle(terminal) || terminal.terminalId}
									</div>
								</button>
							{/each}
						{/if}
					</ScrollView>
				</section>
			{/snippet}

			{#snippet drawer()}
				{#if selectedTerminal}
					{@const terminal = selectedTerminal}
					<section class="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 rounded-lg border border-border/70 bg-background/50 p-2">
						<header class="grid gap-2">
							<div class="flex flex-wrap items-start justify-between gap-2">
								<div class="min-w-0 grid gap-1">
									<h2 class="truncate text-xs font-semibold">{resolveTerminalInstanceName(terminal)}</h2>
									<div class="break-all text-[10px] text-muted-foreground">{terminal.terminalId}</div>
								</div>
								<div class="rounded-full border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
									{terminal.processPhase}
								</div>
							</div>
							<div class="flex flex-wrap gap-1">
								{#each resolveTerminalLifecycleFacts(terminal) as fact (fact.key)}
									<div class="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
										{fact.label}
									</div>
								{/each}
							</div>
						</header>

						<ScrollView
							class="h-full"
							viewportTestId="terminal-history-detail-viewport"
							contentClass="grid gap-1.5 pr-1"
						>
							{#each resolveTerminalDetailRows(terminal) as row (row.label)}
								<div class="grid gap-0.5 rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5">
									<div class="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
										{row.label}
									</div>
									<div class="break-all text-xs">{row.value}</div>
								</div>
							{/each}
						</ScrollView>

						<div class="flex flex-wrap gap-2 border-t border-border/60 pt-2">
							<Button size="sm" onclick={() => void openTerminalDetail(terminal.terminalId)}>
								<ExternalLinkIcon class="size-4" />
								Open detail
							</Button>
							{#if isKilledTerminal(terminal)}
								<Button
									size="sm"
									variant="outline"
									disabled={isBusy(terminal.terminalId)}
									onclick={() => void handleArchive(terminal.terminalId)}
								>
									<ArchiveIcon class="size-4" />
									{busyByTerminalId[terminal.terminalId] === 'archive' ? 'Archiving…' : 'Archive'}
								</Button>
								<Button
									size="sm"
									variant="outline"
									class="text-destructive"
									disabled={isBusy(terminal.terminalId)}
									onclick={() => void handleDelete(terminal.terminalId)}
								>
									<Trash2Icon class="size-4" />
									{busyByTerminalId[terminal.terminalId] === 'delete' ? 'Deleting…' : 'Delete'}
								</Button>
							{/if}
						</div>
					</section>
				{:else}
					<div class="grid h-full place-items-center rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
						Select a terminal to inspect its retained facts.
					</div>
				{/if}
			{/snippet}
		</WorkbenchSplitDetailHost>
	{/if}
</WorkbenchScaffold>
