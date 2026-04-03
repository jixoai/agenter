<script lang="ts">
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import BotIcon from '@lucide/svelte/icons/bot';
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import MailIcon from '@lucide/svelte/icons/mail';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';
	import StopCircleIcon from '@lucide/svelte/icons/stop-circle';
	import WaypointsIcon from '@lucide/svelte/icons/waypoints';

	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import PanelShell from '$lib/components/panel-shell.svelte';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import ScrollView from '$lib/components/scroll-view.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import RuntimeTabBar from './runtime-tab-bar.svelte';
	import {
		basenameWorkspace,
		buildRuntimeTabs,
		normalizeRuntimeTab,
		resolveRuntimeStatusLabel,
		resolveRuntimeStatusTone,
		type RuntimeTabId,
	} from './runtime-shell-state';

	let {
		sessionId,
		tab,
	}: {
		sessionId: string;
		tab?: string;
	} = $props();

	const controller = getAppControllerContext();

	const activeTab = $derived(normalizeRuntimeTab(tab));
	const session = $derived(controller.runtimeState.sessions.find((entry) => entry.id === sessionId) ?? null);
	const runtime = $derived(session ? controller.runtimeState.runtimes[session.id] ?? null : null);
	const channels = $derived(
		controller.runtimeState.messageChannelsBySession[sessionId]?.data?.filter((channel) => !channel.archivedAt) ?? [],
	);
	const terminals = $derived(runtime?.terminals ?? []);
	const cycles = $derived(controller.runtimeState.chatCyclesBySession[sessionId] ?? []);
	const activeCycle = $derived(runtime?.activeCycle ?? null);
	const latestCycle = $derived(cycles[cycles.length - 1] ?? activeCycle ?? null);
	const tabs = $derived(buildRuntimeTabs({ activeCycle, latestCycle }));
	const workspaceLabel = $derived(session ? basenameWorkspace(session.workspacePath) : 'Unknown workspace');
	const sessionIconUrl = $derived(session ? controller.runtimeStore.sessionIconUrl(session.id) : null);
	const unreadCount = $derived(controller.runtimeState.unreadBySession[sessionId] ?? 0);
	const isRunning = $derived(session?.status === 'running' || session?.status === 'starting');
	const attentionSummary = $derived({
		contexts: runtime?.attention?.snapshot.contexts.length ?? 0,
		active: runtime?.attention?.active.length ?? 0,
		hooks: runtime?.attention?.hooks.length ?? 0,
	});

	const openRoom = async (chatId: string): Promise<void> => {
		await goto(`/messages?roomId=${encodeURIComponent(chatId)}`);
	};

	const openTerminal = async (terminalId: string): Promise<void> => {
		await goto(`/terminals?terminalId=${encodeURIComponent(terminalId)}`);
	};

	const toggleRuntime = async (): Promise<void> => {
		if (!session) {
			return;
		}
		if (session.status === 'running' || session.status === 'starting') {
			await controller.runtimeStore.stopSession(session.id);
			return;
		}
		await controller.runtimeStore.startSession(session.id);
	};
</script>

{#if !session}
	<div class="flex h-full items-center justify-center p-6">
		<Card.Root class="max-w-lg">
			<Card.Header>
				<Card.Title>Runtime unavailable</Card.Title>
				<Card.Description>The selected AvatarSession no longer exists in the global runtime snapshot.</Card.Description>
			</Card.Header>
		</Card.Root>
	</div>
{:else}
	<div class="grid h-full gap-4 p-4 md:grid-rows-[auto_minmax(0,1fr)] md:p-6">
		<PanelShell headerClass="gap-4">
			{#snippet header()}
				<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div class="flex min-w-0 items-start gap-4">
						<div class="relative shrink-0">
							<ProfileAvatar label={session.avatar || session.name} src={sessionIconUrl} class="size-14 rounded-2xl" />
							<div class={cn('absolute -bottom-1 -right-1 size-3 rounded-full ring-4 ring-background', resolveRuntimeStatusTone(session.status))}></div>
						</div>
						<div class="min-w-0">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Running Avatar</div>
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<h1 class="truncate text-2xl font-semibold">{session.avatar || session.name}</h1>
								<div class="rounded-full border px-2 py-1 text-[11px]">{resolveRuntimeStatusLabel(session.status)}</div>
								{#if unreadCount > 0}
									<div class="rounded-full bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white">
										{unreadCount} unread
									</div>
								{/if}
							</div>
							<div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
								<FolderTreeIcon class="size-4" />
								<span>{workspaceLabel}</span>
								<span>·</span>
								<span class="break-all">{session.workspacePath}</span>
							</div>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<Button variant="outline" onclick={() => void controller.refreshBootstrap()} aria-label="Refresh runtime">
							<RefreshCwIcon class={cn('size-4', controller.refreshing && 'animate-spin')} />
							Refresh
						</Button>
						<Button variant={isRunning ? 'destructive' : 'default'} onclick={() => void toggleRuntime()}>
							{#if isRunning}
								<StopCircleIcon class="size-4" />
								Stop
							{:else}
								<PlayIcon class="size-4" />
								Start
							{/if}
						</Button>
					</div>
				</div>

				<RuntimeTabBar {sessionId} {tabs} activeTab={activeTab} />
			{/snippet}
		</PanelShell>

		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<PanelShell bodyClass="h-full">
				<ScrollView class="h-full" contentClass="grid gap-4 p-4">
						{#if activeTab === 'attention'}
							<div class="grid gap-4 md:grid-cols-3">
								<div class="rounded-2xl border bg-muted/25 p-4">
									<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contexts</div>
									<div class="mt-2 text-2xl font-semibold">{attentionSummary.contexts}</div>
								</div>
								<div class="rounded-2xl border bg-muted/25 p-4">
									<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active attention</div>
									<div class="mt-2 text-2xl font-semibold">{attentionSummary.active}</div>
								</div>
								<div class="rounded-2xl border bg-muted/25 p-4">
									<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hooks</div>
									<div class="mt-2 text-2xl font-semibold">{attentionSummary.hooks}</div>
								</div>
							</div>
						{:else if activeTab === 'cycles'}

							<div class="grid gap-3">
								{#if cycles.length === 0}
									<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
										No cycle history yet.
									</div>
								{:else}
									{#each [...cycles].reverse() as cycle (cycle.id)}
										<div class="rounded-2xl border p-4">
											<div class="flex items-center justify-between gap-3">
												<div class="min-w-0">
													<div class="text-sm font-semibold">
														Cycle {cycle.cycleId === null ? 'pending' : cycle.cycleId}
													</div>
													<div class="text-xs text-muted-foreground">
														{cycle.kind} · {cycle.status}
													</div>
												</div>
												<div class={cn('rounded-full px-2 py-1 text-[11px] font-semibold', resolveRuntimeStatusTone(cycle.status === 'error' ? 'error' : cycle.status === 'done' ? 'running' : 'starting'))}>
													{cycle.status}
												</div>
											</div>
											<div class="mt-3 text-xs text-muted-foreground">
												Inputs {cycle.inputs.length} · Outputs {cycle.outputs.length} · Live messages {cycle.liveMessages.length}
											</div>
										</div>
									{/each}
								{/if}
							</div>
						{:else if activeTab === 'systems'}

							<div class="grid gap-4 md:grid-cols-2">
								<div class="rounded-2xl border p-4">
									<div class="flex items-center gap-2 text-sm font-semibold">
										<MailIcon class="size-4" />
										Message channels
									</div>
									<div class="mt-3 text-sm text-muted-foreground">{channels.length} linked channels</div>
								</div>
								<div class="rounded-2xl border p-4">
									<div class="flex items-center gap-2 text-sm font-semibold">
										<SquareTerminalIcon class="size-4" />
										Terminals
									</div>
									<div class="mt-3 text-sm text-muted-foreground">{terminals.length} linked terminals</div>
								</div>
							</div>
						{:else if activeTab === 'observability'}

							<div class="grid gap-4 md:grid-cols-2">
								<div class="rounded-2xl border p-4">
									<div class="text-sm font-semibold">Scheduler</div>
									<div class="mt-3 text-sm text-muted-foreground">
										{runtime?.schedulerState?.runtimeStatus ?? 'waiting_input'} · {runtime?.schedulerPhase ?? 'idle'}
									</div>
								</div>
								<div class="rounded-2xl border p-4">
									<div class="text-sm font-semibold">Last error</div>
									<div class="mt-3 break-all text-sm text-muted-foreground">
										{runtime?.schedulerState?.lastError ?? session.lastError ?? 'None'}
									</div>
								</div>
							</div>
						{:else}

							<div class="rounded-2xl border p-4">
								<div class="flex items-center gap-2 text-sm font-semibold">
									<Settings2Icon class="size-4" />
									Runtime-facing settings
								</div>
								<div class="mt-3 text-sm text-muted-foreground">
									This shell already flattens Settings into the runtime layer. The full editor stays in the next implementation slice.
								</div>
								<div class="mt-4 grid gap-2 text-sm">
									<div>Workspace: {session.workspacePath}</div>
									<div>Avatar: {session.avatar}</div>
									<div>Session id: {session.id}</div>
								</div>
							</div>
						{/if}
				</ScrollView>
			</PanelShell>

			<PanelShell bodyClass="h-full">
				{#snippet header()}
					<h2 class="text-base font-semibold">Linked Systems</h2>
					<p class="text-sm text-muted-foreground">
						Jump out to the orthogonal global system surfaces. Runtime shell does not embed duplicate catalogs.
					</p>
				{/snippet}

				<ScrollView class="h-full" contentClass="grid gap-3 p-4">
						<div class="rounded-2xl border p-4">
							<div class="flex items-center gap-2 text-sm font-semibold">
								<MailIcon class="size-4" />
								Message-system
							</div>
							<div class="mt-3 grid gap-2">
								{#if channels.length === 0}
									<div class="text-sm text-muted-foreground">No linked rooms.</div>
								{:else}
									{#each channels as channel (channel.chatId)}
										<button
											class="flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted/40"
											onclick={() => void openRoom(channel.chatId)}
										>
											<div class="min-w-0">
												<div class="truncate text-sm font-medium">{channel.title}</div>
												<div class="truncate text-[11px] text-muted-foreground">{channel.chatId}</div>
											</div>
											<ArrowRightIcon class="size-4 shrink-0 text-muted-foreground" />
										</button>
									{/each}
								{/if}
							</div>
						</div>

						<div class="rounded-2xl border p-4">
							<div class="flex items-center gap-2 text-sm font-semibold">
								<SquareTerminalIcon class="size-4" />
								Terminal-system
							</div>
							<div class="mt-3 grid gap-2">
								{#if terminals.length === 0}
									<div class="text-sm text-muted-foreground">No linked terminals.</div>
								{:else}
									{#each terminals as terminal (terminal.terminalId)}
										<button
											class="flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted/40"
											onclick={() => void openTerminal(terminal.terminalId)}
										>
											<div class="min-w-0">
												<div class="truncate text-sm font-medium">{terminal.title || terminal.terminalId}</div>
												<div class="truncate text-[11px] text-muted-foreground">{terminal.cwd}</div>
											</div>
											<ArrowRightIcon class="size-4 shrink-0 text-muted-foreground" />
										</button>
									{/each}
								{/if}
							</div>
						</div>

						<div class="rounded-2xl border p-4">
							<div class="flex items-center gap-2 text-sm font-semibold">
								<WaypointsIcon class="size-4" />
								Runtime facts
							</div>
							<div class="mt-3 grid gap-2 text-sm text-muted-foreground">
								<div class="flex items-center gap-2"><BotIcon class="size-4" /> <span>{session.name}</span></div>
								<div class="flex items-center gap-2"><FolderTreeIcon class="size-4" /> <span>{workspaceLabel}</span></div>
								<div class="flex items-center gap-2"><MailIcon class="size-4" /> <span>{channels.length} rooms</span></div>
								<div class="flex items-center gap-2"><SquareTerminalIcon class="size-4" /> <span>{terminals.length} terminals</span></div>
							</div>
						</div>
				</ScrollView>
			</PanelShell>
		</div>
	</div>
{/if}
