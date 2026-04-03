<script lang="ts">
	import BotIcon from '@lucide/svelte/icons/bot';
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import MailIcon from '@lucide/svelte/icons/mail';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';

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
	let openSections = $state<string[]>(['quick-jumps']);
</script>

<Card.Root data-testid="runtime-secondary-rail-mobile">
	<Card.Header class="border-b">
		<Card.Title>Session context</Card.Title>
		<Card.Description>Open the facts you need without keeping the secondary rail fully expanded.</Card.Description>
	</Card.Header>
	<Card.Content class="p-0">
		<Accordion.Root type="multiple" bind:value={openSections} class="rounded-none border-0">
			<Accordion.Item value="quick-jumps">
				<Accordion.Trigger class="px-4 py-4 text-sm hover:no-underline">
					<span class="grid gap-1">
						<span class="flex items-center gap-2">
							<span>Quick jumps</span>
							<Badge variant="outline">{channels.length + terminals.length}</Badge>
						</span>
						<span class="text-xs font-normal text-muted-foreground">
							Jump to the full room or terminal surface only when deeper work is needed.
						</span>
					</span>
				</Accordion.Trigger>
				<Accordion.Content class="grid gap-4 px-2 pb-4">
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
									variant="outline"
									class="h-auto w-full justify-start rounded-xl px-3 py-3 text-left"
									onclick={() => onOpenRoom(channel.chatId)}
								>
									<span class="grid justify-items-start gap-1">
										<span class="text-sm font-medium">{channel.title}</span>
										<span class="text-xs font-normal text-muted-foreground">{channel.chatId}</span>
									</span>
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
									variant="outline"
									class="h-auto w-full justify-start rounded-xl px-3 py-3 text-left"
									onclick={() => onOpenTerminal(terminal.terminalId)}
								>
									<span class="grid justify-items-start gap-1">
										<span class="text-sm font-medium">{terminal.title || terminal.terminalId}</span>
										<span class="text-xs font-normal text-muted-foreground">{terminal.cwd}</span>
									</span>
								</Button>
							{/each}
						{/if}
					</div>
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="runtime-facts">
				<Accordion.Trigger class="px-4 py-4 text-sm hover:no-underline">
					<span class="grid gap-1">
						<span>Runtime facts</span>
						<span class="text-xs font-normal text-muted-foreground">
							Quiet metadata about the running avatar and its linked systems.
						</span>
					</span>
				</Accordion.Trigger>
				<Accordion.Content class="grid gap-3 px-4 pb-4 text-sm text-muted-foreground">
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
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="session-posture">
				<Accordion.Trigger class="px-4 py-4 text-sm hover:no-underline">
					<span class="grid gap-1">
						<span>Session posture</span>
						<span class="text-xs font-normal text-muted-foreground">
							Unread pressure and scheduler phase stay compact until requested.
						</span>
					</span>
				</Accordion.Trigger>
				<Accordion.Content class="px-4 pb-4">
					<div class="flex flex-wrap gap-2">
						<Badge variant="outline">{resolveRuntimeStatusLabel(session.status)}</Badge>
						{#if unreadCount > 0}
							<Badge variant="secondary">{unreadCount} unread</Badge>
						{/if}
						<Badge variant="outline">{runtime?.schedulerPhase ?? 'idle'}</Badge>
					</div>
				</Accordion.Content>
			</Accordion.Item>
		</Accordion.Root>
	</Card.Content>
</Card.Root>
