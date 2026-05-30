<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { buttonVariants } from '$lib/components/ui/button/button.variants.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import CopyIconButton from '$lib/components/ui/copy-icon-button.svelte';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import { cn } from '$lib/utils.js';

	import type { MessageSystemRoomSeatState } from './message-system-surface.types';

	interface Props {
		seat: MessageSystemRoomSeatState;
		token: string | null;
		transportUrl: string | null;
	}

	let { seat, token, transportUrl }: Props = $props();

	let urlOpen = $state(false);

	const describeSeatIdentity = (state: MessageSystemRoomSeatState): string =>
		state.subtitle?.trim() || state.actorId;

	const toggleUrlLabel = $derived(
		urlOpen ? `Hide WebSocket URL for ${seat.label}` : `Show WebSocket URL for ${seat.label}`,
	);
</script>

<Item.Root size="sm" class="grid gap-3" data-testid={`room-share-seat-${seat.actorId}`}>
	<Collapsible.Root bind:open={urlOpen} class="grid gap-3">
		<div class="flex min-w-0 items-start gap-3">
			<ProfileAvatar label={seat.label} src={seat.iconUrl} class="mt-0.5 size-10 rounded-xl" />
			<div class="grid min-w-0 flex-1 gap-3">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="grid min-w-0 gap-1">
						<div class="flex flex-wrap items-center gap-2">
							<div class="truncate text-sm font-semibold">{seat.label}</div>
							<Badge
								variant="outline"
								class="rounded-full text-[10px] font-semibold tracking-[0.16em] uppercase"
							>
								{seat.role}
							</Badge>
							{#if seat.currentAdmin}
								<Badge class="rounded-full text-[10px]" variant="secondary">Current admin</Badge>
							{/if}
						</div>
						<div class="break-all text-xs text-muted-foreground">{describeSeatIdentity(seat)}</div>
					</div>

					{#if transportUrl}
						<Collapsible.Trigger
							class={cn(
								buttonVariants({ variant: 'ghost', size: 'sm' }),
								'h-8 rounded-full px-2 text-xs text-muted-foreground',
							)}
							aria-label={toggleUrlLabel}
							title={toggleUrlLabel}
						>
							{#if urlOpen}
								<ChevronDownIcon class="size-4" />
							{:else}
								<ChevronRightIcon class="size-4" />
							{/if}
							URL
						</Collapsible.Trigger>
					{/if}
				</div>

				{#if token}
					<div class="grid gap-1.5">
						<div class="text-xs font-medium text-muted-foreground">Access token</div>
						<InputGroup.Root>
							<InputGroup.Input
								value={token}
								readonly
								class="font-mono text-xs"
								aria-label={`Access token for ${seat.label}`}
							/>
							<InputGroup.Addon>
								<CopyIconButton
									value={token}
									label={`Copy token for ${seat.label}`}
									class="size-7 rounded-md"
								/>
							</InputGroup.Addon>
						</InputGroup.Root>
					</div>
				{:else}
					<NoticeBanner tone="warning" message="No grant token is available for this user." />
				{/if}

				{#if transportUrl}
					<Collapsible.Content class="grid gap-1.5">
						<div class="text-xs font-medium text-muted-foreground">WebSocket URL</div>
						<InputGroup.Root layout="block">
							<InputGroup.Textarea
								value={transportUrl}
								readonly
								rows={2}
								class="resize-none font-mono text-xs"
								aria-label={`WebSocket URL for ${seat.label}`}
							/>
							<InputGroup.Addon align="block-end" class="justify-end">
								<CopyIconButton
									value={transportUrl}
									label={`Copy websocket URL for ${seat.label}`}
									class="size-7 rounded-md"
								/>
							</InputGroup.Addon>
						</InputGroup.Root>
					</Collapsible.Content>
				{/if}
			</div>
		</div>
	</Collapsible.Root>
</Item.Root>
