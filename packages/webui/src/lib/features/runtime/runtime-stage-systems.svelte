<script lang="ts">
	import MailIcon from '@lucide/svelte/icons/mail';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';
	import type { MessageChannelEntry, RuntimeSnapshotEntry } from '@agenter/client-sdk';

import * as Card from '$lib/components/ui/card/index.js';

	let {
		runtime,
		channels,
	}: {
		runtime: RuntimeSnapshotEntry | null;
		channels: MessageChannelEntry[];
	} = $props();

	const terminals = $derived(runtime?.terminals ?? []);
	const resolveTerminalTitle = (terminal: RuntimeSnapshotEntry['terminals'][number]): string =>
		terminal.currentTitle || terminal.configuredTitle || terminal.terminalId;
	const resolveTerminalPath = (terminal: RuntimeSnapshotEntry['terminals'][number]): string =>
		terminal.currentPath || terminal.launchCwd;
</script>

<div class="grid auto-rows-max gap-4" data-testid="runtime-systems-stage">
	<div class="grid gap-4">
		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Message-system links</Card.Title>
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
				<Card.Title>Terminal-system links</Card.Title>
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
								<div class="text-sm font-semibold">{resolveTerminalTitle(terminal)}</div>
								<span class="text-xs text-muted-foreground">
									{terminal.processPhase === 'running' ? terminal.status : terminal.processPhase}
								</span>
							</div>
							<div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
								<SquareTerminalIcon class="size-3" />
								<span class="break-all">{resolveTerminalPath(terminal)}</span>
							</div>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
