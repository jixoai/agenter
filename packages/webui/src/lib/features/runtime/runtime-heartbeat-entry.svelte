<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';

	import type { HeartbeatPartItem } from '@agenter/client-sdk';

	import { Action, Actions } from '$lib/components/ai-elements/action/index.js';
	import { Checkpoint, CheckpointIcon } from '$lib/components/ai-elements/checkpoint/index.js';
	import { Message, MessageAvatar, MessageContent } from '$lib/components/ai-elements/message/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	import RuntimeHeartbeatPartContent from './runtime-heartbeat-part-content.svelte';
	import RuntimeHeartbeatToolBlock from './runtime-heartbeat-tool-block.svelte';
	import {
		buildHeartbeatDisplayBlocks,
		buildHeartbeatEntryClipboardText,
		getHeartbeatMessageFrom,
		getHeartbeatRowLabel,
		getHeartbeatRowMeta,
		getHeartbeatRowPreviewLine,
		isHeartbeatCompactRow,
		isHeartbeatRowFoldedByDefault,
	} from './runtime-heartbeat-parts';
	import { formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		entry,
		sessionIconUrl = null,
		avatarLabel = 'Avatar',
	}: {
		entry: HeartbeatPartItem;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	const compactRow = $derived(isHeartbeatCompactRow(entry));
	const foldedByDefault = $derived(isHeartbeatRowFoldedByDefault(entry));
	const summary = $derived(getHeartbeatRowPreviewLine(entry));
	const meta = $derived(getHeartbeatRowMeta(entry));
	const messageFrom = $derived(getHeartbeatMessageFrom(entry));
	const displayBlocks = $derived(buildHeartbeatDisplayBlocks(entry));

	const copyEntry = async (): Promise<void> => {
		if (typeof navigator === 'undefined' || !navigator.clipboard) {
			return;
		}
		await navigator.clipboard.writeText(buildHeartbeatEntryClipboardText(entry));
	};
</script>

{#if compactRow}
	<div class="py-1" data-testid={`runtime-heartbeat-entry-${entry.id}`}>
		<Checkpoint class="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3 py-2">
			<CheckpointIcon />
				<div class="grid min-w-0 gap-1">
					<div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
						<Badge variant="outline">{getHeartbeatRowLabel(entry)}</Badge>
						{#each meta as item (item)}
							<Badge variant="secondary">{item}</Badge>
						{/each}
					<span>{formatRuntimeTimestamp(entry.createdAt)}</span>
				</div>
				<div class="text-sm leading-6 text-muted-foreground">{summary}</div>
			</div>
			<Actions class="shrink-0">
				<Action tooltip="Copy row" label="Copy row" onclick={() => void copyEntry()}>
					<Copy class="size-4" />
				</Action>
			</Actions>
		</Checkpoint>
	</div>
{:else if foldedByDefault}
	<details
		open={false}
		class="group rounded-[1.6rem]"
		data-testid={`runtime-heartbeat-entry-${entry.id}`}
	>
		<summary class="cursor-pointer list-none">
			<Message from={messageFrom}>
				<MessageAvatar name={avatarLabel} src={sessionIconUrl} />
				<MessageContent
					variant="flat"
					from="assistant"
					class="gap-2 bg-card/95"
				>
					<div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
						<Badge variant="outline">{getHeartbeatRowLabel(entry)}</Badge>
						{#each meta as item (item)}
							<Badge variant="secondary">{item}</Badge>
						{/each}
						<span>{formatRuntimeTimestamp(entry.createdAt)}</span>
					</div>
					<div class="text-sm leading-6 text-foreground">{summary}</div>
				</MessageContent>
			</Message>
		</summary>

		<div class={cn('grid gap-3 px-11 pb-3', messageFrom === 'user' ? 'justify-items-end pr-11 pl-3' : 'pl-11 pr-3')}>
			<div class="grid w-full max-w-[min(58rem,100%)] gap-3">
				{#each displayBlocks as block (`${entry.id}:${block.kind}:${block.kind === 'tool' ? block.key : block.part.partId}`)}
					{#if block.kind === 'tool'}
						<RuntimeHeartbeatToolBlock {block} />
					{:else}
						<RuntimeHeartbeatPartContent part={block.part} />
					{/if}
				{/each}
				<Actions>
					<Action tooltip="Copy row" label="Copy row" onclick={() => void copyEntry()}>
						<Copy class="size-4" />
					</Action>
				</Actions>
			</div>
		</div>
	</details>
{:else}
	<div data-testid={`runtime-heartbeat-entry-${entry.id}`}>
		<Message from={messageFrom}>
			<MessageAvatar name={avatarLabel} src={sessionIconUrl} />
			<MessageContent
				variant="flat"
				from="assistant"
				class="gap-3 bg-card/95"
			>
				<div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
					{#each meta as item (item)}
						<Badge variant="secondary">{item}</Badge>
					{/each}
					<span>{formatRuntimeTimestamp(entry.createdAt)}</span>
				</div>

				{#each displayBlocks as block (`${entry.id}:${block.kind}:${block.kind === 'tool' ? block.key : block.part.partId}`)}
					{#if block.kind === 'tool'}
						<RuntimeHeartbeatToolBlock {block} />
					{:else}
						<RuntimeHeartbeatPartContent part={block.part} />
					{/if}
				{/each}

				<Actions>
					<Action tooltip="Copy row" label="Copy row" onclick={() => void copyEntry()}>
						<Copy class="size-4" />
					</Action>
				</Actions>
			</MessageContent>
		</Message>
	</div>
{/if}
