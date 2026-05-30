<script lang="ts">
	import LinkIcon from '@lucide/svelte/icons/link';
	import type { GlobalRoomEntry } from '@agenter/client-sdk';

	import CopyIconButton from '$lib/components/ui/copy-icon-button.svelte';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';

	import MessageRoomManageShareSeat from './message-room-manage-share-seat.svelte';
	import type { MessageSystemRoomSeatState } from './message-system-surface.types';

	interface SeatShareProjection {
		seat: MessageSystemRoomSeatState;
		token: string | null;
		transportUrl: string | null;
	}

	interface Props {
		selectedRoom: GlobalRoomEntry;
		roomSeatStates: MessageSystemRoomSeatState[];
	}

	let { selectedRoom, roomSeatStates }: Props = $props();

	const parseTransportUrl = (value?: string): URL | null => {
		if (!value) {
			return null;
		}
		try {
			return new URL(value);
		} catch {
			return null;
		}
	};

	const stripTokenFromTransportUrl = (value?: string): string | null => {
		const url = parseTransportUrl(value);
		if (!url) {
			return null;
		}
		url.searchParams.delete('token');
		return url.toString();
	};

	const buildTransportUrlForToken = (token?: string): string | null => {
		if (!token) {
			return null;
		}
		const url = parseTransportUrl(selectedRoom.transportUrl);
		if (!url) {
			return null;
		}
		url.searchParams.set('token', token);
		return url.toString();
	};

	const websocketBaseUrl = $derived(stripTokenFromTransportUrl(selectedRoom.transportUrl));
	const currentProjectionUrl = $derived(selectedRoom.transportUrl ?? null);
	const seatShareProjections = $derived.by(() =>
		roomSeatStates.map(
			(seat): SeatShareProjection => ({
				seat,
				token: seat.accessToken ?? null,
				transportUrl: buildTransportUrlForToken(seat.accessToken),
			}),
		),
	);
</script>

<div class="grid auto-rows-max gap-4" data-testid="room-manage-share-section">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="grid gap-1">
			<h3 class="text-sm font-semibold">Share</h3>
			<p class="text-xs text-muted-foreground">
				Copy the room WebSocket endpoint and per-user grant tokens.
			</p>
		</div>
		<div class="rounded-full border border-border/70 px-2 py-1 font-mono text-[11px] text-muted-foreground">
			{selectedRoom.chatId}
		</div>
	</div>

	{#if !currentProjectionUrl}
		<NoticeBanner
			tone="warning"
			message="WebSocket transport URL is not available in the current room projection."
		/>
	{/if}

	<div class="grid auto-rows-max gap-2.5">
		<Item.Root size="sm" class="grid gap-3">
			<div class="flex min-w-0 items-start gap-3">
				<div
					class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/45 text-muted-foreground"
				>
					<LinkIcon class="size-4" />
				</div>
				<div class="grid min-w-0 flex-1 gap-3">
					<div class="grid gap-1">
						<div class="text-sm font-semibold">WebSocket endpoint</div>
						<div class="text-xs text-muted-foreground">{selectedRoom.title || selectedRoom.chatId}</div>
					</div>
					<InputGroup.Root layout="block">
						<InputGroup.Textarea
							value={websocketBaseUrl ?? ''}
							readonly
							rows={2}
							class="resize-none font-mono text-xs"
							aria-label="WebSocket base URL"
							disabled={!websocketBaseUrl}
						/>
						<InputGroup.Addon align="block-end" class="justify-between">
							<span class="text-xs">Base URL</span>
							<CopyIconButton
								value={websocketBaseUrl ?? ''}
								label="Copy room websocket base URL"
								class="size-7 rounded-md"
								disabled={!websocketBaseUrl}
							/>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>
			</div>
		</Item.Root>

		{#if seatShareProjections.length === 0}
			<Item.Root size="sm" variant="muted" class="grid gap-2 py-8 text-sm text-muted-foreground">
				<div>No room users are available yet.</div>
				<div>Open Users to grant the first shareable seat.</div>
			</Item.Root>
		{:else}
			{#each seatShareProjections as projection (projection.seat.actorId)}
				<MessageRoomManageShareSeat
					seat={projection.seat}
					token={projection.token}
					transportUrl={projection.transportUrl}
				/>
			{/each}
		{/if}
	</div>
</div>
