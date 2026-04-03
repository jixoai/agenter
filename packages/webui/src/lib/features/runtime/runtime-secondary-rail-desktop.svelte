<script lang="ts">
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import BotIcon from '@lucide/svelte/icons/bot';
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import MailIcon from '@lucide/svelte/icons/mail';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';

	import PanelShell from '$lib/components/panel-shell.svelte';
	import ScrollView from '$lib/components/scroll-view.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import { resolveRuntimeStatusLabel } from './runtime-shell-state';
	import type { RuntimeSecondaryRailProps } from './runtime-secondary-rail.types';

	let {
		session,
		runtime,
		channels,
		workspaceLabel,
		unreadCount,
		onOpenRoom,
		onOpenTerminal,
	}: RuntimeSecondaryRailProps = $props();

	const terminals = $derived(runtime?.terminals ?? []);
</script>

<PanelShell bodyClass="h-full" data-testid="runtime-secondary-rail-desktop">
	{#snippet header()}
		<div class="grid gap-1">
			<h2 class="text-sm font-semibold">Session context</h2>
			<p class="text-sm text-muted-foreground">
				Quick jumps and durable runtime facts stay available without competing with the main stage.
			</p>
		</div>
	{/snippet}

	<ScrollView class="h-full" contentClass="grid auto-rows-max gap-3 p-4">
		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Quick jumps</Card.Title>
				<Card.Description>
					Leave the runtime shell only when you need the full room or terminal product surface.
				</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				<div class="grid gap-2">
					<div class="flex items-center justify-between gap-2 text-sm font-medium">
						<span>Rooms</span>
						<Badge variant="outline">{channels.length}</Badge>
					</div>
					{#if channels.length === 0}
						<div class="rounded-xl border border-dashed px-3 py-4 text-xs text-muted-foreground">
							No linked rooms.
						</div>
					{:else}
						{#each channels as channel (channel.chatId)}
							<Button
								variant="ghost"
								class="h-auto w-full justify-between rounded-xl border px-3 py-3 text-left"
								onclick={() => onOpenRoom(channel.chatId)}
							>
								<span class="grid justify-items-start gap-1">
									<span class="text-sm font-medium">{channel.title}</span>
									<span class="text-xs font-normal text-muted-foreground">{channel.chatId}</span>
								</span>
								<ArrowRightIcon class="size-4" />
							</Button>
						{/each}
					{/if}
				</div>

				<div class="grid gap-2">
					<div class="flex items-center justify-between gap-2 text-sm font-medium">
						<span>Terminals</span>
						<Badge variant="outline">{terminals.length}</Badge>
					</div>
					{#if terminals.length === 0}
						<div class="rounded-xl border border-dashed px-3 py-4 text-xs text-muted-foreground">
							No linked terminals.
						</div>
					{:else}
						{#each terminals as terminal (terminal.terminalId)}
							<Button
								variant="ghost"
								class="h-auto w-full justify-between rounded-xl border px-3 py-3 text-left"
								onclick={() => onOpenTerminal(terminal.terminalId)}
							>
								<span class="grid justify-items-start gap-1">
									<span class="text-sm font-medium">{terminal.title || terminal.terminalId}</span>
									<span class="text-xs font-normal text-muted-foreground">{terminal.cwd}</span>
								</span>
								<ArrowRightIcon class="size-4" />
							</Button>
						{/each}
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Runtime facts</Card.Title>
				<Card.Description>Quiet metadata for the current running avatar.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6 text-sm text-muted-foreground">
				<div class="flex items-center gap-2">
					<BotIcon class="size-4" />
					<span>{session.avatar || session.name}</span>
				</div>
				<div class="flex items-center gap-2">
					<FolderTreeIcon class="size-4" />
					<span>{workspaceLabel}</span>
				</div>
				<div class="flex items-center gap-2">
					<MailIcon class="size-4" />
					<span>{channels.length} linked rooms</span>
				</div>
				<div class="flex items-center gap-2">
					<SquareTerminalIcon class="size-4" />
					<span>{terminals.length} linked terminals</span>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Session posture</Card.Title>
				<Card.Description>
					Durable state, unread pressure, and scheduler phase stay visible as secondary facts.
				</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				<div class="flex flex-wrap gap-2">
					<Badge variant="outline">{resolveRuntimeStatusLabel(session.status)}</Badge>
					{#if unreadCount > 0}
						<Badge variant="secondary">{unreadCount} unread</Badge>
					{/if}
					<Badge variant="outline">{runtime?.schedulerPhase ?? 'idle'}</Badge>
				</div>
			</Card.Content>
		</Card.Root>
	</ScrollView>
</PanelShell>
