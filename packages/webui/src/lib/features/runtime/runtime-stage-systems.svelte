<script lang="ts">
	import MailIcon from '@lucide/svelte/icons/mail';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';
	import type { MessageChannelEntry, RuntimeSnapshotEntry } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	let {
		runtime,
		channels,
	}: {
		runtime: RuntimeSnapshotEntry | null;
		channels: MessageChannelEntry[];
	} = $props();

	const terminals = $derived(runtime?.terminals ?? []);
</script>

<div class="grid auto-rows-max gap-4" data-testid="runtime-systems-stage">
	<div class="grid gap-3 md:grid-cols-2">
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Message channels</div>
			<div class="mt-2 text-2xl font-semibold">{channels.length}</div>
		</div>
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Terminals</div>
			<div class="mt-2 text-2xl font-semibold">{terminals.length}</div>
		</div>
	</div>

	<div class="grid gap-4 xl:grid-cols-2">
		<Card.Root>
			<Card.Header class="border-b">
				<Card.Action>
					<Badge variant="outline">{channels.length} rooms</Badge>
				</Card.Action>
				<Card.Title>Message-system links</Card.Title>
				<Card.Description>Rooms are orthogonal channels. The runtime attaches to them without taking ownership of the message-system catalog.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				{#if channels.length === 0}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
						No linked rooms are attached to this runtime.
					</div>
				{:else}
					{#each channels as channel (channel.chatId)}
						<div class="rounded-xl border px-4 py-3">
							<div class="text-sm font-semibold">{channel.title}</div>
							<div class="mt-1 break-all text-xs text-muted-foreground">{channel.chatId}</div>
							<div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
								<MailIcon class="size-3" />
								<span>{channel.accessRole}</span>
							</div>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="border-b">
				<Card.Action>
					<Badge variant="outline">{terminals.length} terminals</Badge>
				</Card.Action>
				<Card.Title>Terminal-system links</Card.Title>
				<Card.Description>Focused and linked terminals stay in the terminal-system. The runtime only consumes their facts and control endpoints.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				{#if terminals.length === 0}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
						No linked terminals are attached to this runtime.
					</div>
				{:else}
					{#each terminals as terminal (terminal.terminalId)}
						<div class="rounded-xl border px-4 py-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="text-sm font-semibold">{terminal.title || terminal.terminalId}</div>
								<Badge variant={terminal.running ? 'secondary' : 'outline'}>{terminal.status}</Badge>
							</div>
							<div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
								<SquareTerminalIcon class="size-3" />
								<span class="break-all">{terminal.cwd}</span>
							</div>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
