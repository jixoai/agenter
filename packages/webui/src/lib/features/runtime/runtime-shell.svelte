<script lang="ts">
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import StopCircleIcon from '@lucide/svelte/icons/stop-circle';

	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import PanelShell from '$lib/components/panel-shell.svelte';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import RuntimePrimaryStage from './runtime-primary-stage.svelte';
	import RuntimeSecondaryRail from './runtime-secondary-rail.svelte';
	import RuntimeTabBar from './runtime-tab-bar.svelte';
	import {
		basenameWorkspace,
		buildRuntimeTabs,
		normalizeRuntimeTab,
		resolveRuntimeStatusLabel,
		resolveRuntimeStatusTone,
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
	const cycles = $derived(controller.runtimeState.chatCyclesBySession[sessionId] ?? []);
	const activeCycle = $derived(runtime?.activeCycle ?? null);
	const latestCycle = $derived(cycles[cycles.length - 1] ?? activeCycle ?? null);
	const tabs = $derived(buildRuntimeTabs({ activeCycle, latestCycle }));
	const workspaceLabel = $derived(session ? basenameWorkspace(session.workspacePath) : 'Unknown workspace');
	const sessionIconUrl = $derived(session ? controller.runtimeStore.sessionIconUrl(session.id) : null);
	const unreadCount = $derived(controller.runtimeState.unreadBySession[sessionId] ?? 0);
	const isRunning = $derived(session?.status === 'running' || session?.status === 'starting');
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
								<Badge variant="outline">{resolveRuntimeStatusLabel(session.status)}</Badge>
								{#if unreadCount > 0}
									<Badge variant="secondary">{unreadCount} unread</Badge>
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
			<RuntimePrimaryStage
				tab={activeTab}
				{session}
				{runtime}
				{channels}
				{cycles}
				{activeCycle}
				{latestCycle}
			/>

			<RuntimeSecondaryRail
				{session}
				{runtime}
				{channels}
				{workspaceLabel}
				{unreadCount}
				onOpenRoom={(chatId) => void openRoom(chatId)}
				onOpenTerminal={(terminalId) => void openTerminal(terminalId)}
			/>
		</div>
	</div>
{/if}
