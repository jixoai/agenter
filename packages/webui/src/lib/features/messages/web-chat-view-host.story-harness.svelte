<script lang="ts">
	import {
		ScrollView,
		getBottomAnchoredScrollTopFromVirtualOffset,
		getBottomAnchoredStartScrollTop,
		type ScrollController,
	} from '@agenter/svelte-components';
	import type {
		WebChatChannel,
		WebChatSocketFactory,
		WebChatSocketLike,
		WebChatTransportMessage,
		WebChatVisibleMessageFact,
	} from '@agenter/web-chat-view';
	import { WebChatViewHost } from '@agenter/web-chat-view';

	type StoryMessageRecord = Extract<WebChatTransportMessage, { type: 'snapshot' }>['snapshot']['items'][number];

	let { olderPageCount = 6 }: { olderPageCount?: number } = $props();

	const baseTimestamp = 1_710_000_000_000;
	const currentSeedCount = 28;

	const channel = {
		chatId: 'room-story',
		kind: 'room',
		title: 'Operator room',
		owner: 'root',
		participants: [
			{ id: 'system:trusted-bootstrap', label: 'Bootstrap admin' },
			{ id: 'auth:analyst', label: 'Analyst' },
		],
		createdAt: baseTimestamp,
		updatedAt: baseTimestamp + 1_000,
		focused: true,
		accessRole: 'admin',
		accessToken: 'room-token-admin',
		participantId: 'system:trusted-bootstrap',
		currentAdmin: true,
		transportUrl: 'ws://storybook.local/room-story?token=room-token-admin',
	} satisfies WebChatChannel;

	const createMessage = (input: {
		rowId: number;
		content: string;
		from: 'Bootstrap admin' | 'Analyst';
	}): StoryMessageRecord => {
		const timestamp = baseTimestamp + input.rowId * 1_000;
		return {
			rowId: input.rowId,
			messageId: input.rowId,
			chatId: channel.chatId,
			from: input.from,
			kind: 'text',
			content: input.content,
			createdAt: timestamp,
			updatedAt: timestamp,
			visibleAt: timestamp,
			readActorIds: [],
			unreadActorIds: [],
			metadata: {},
			attachments: [],
		};
	};

	const createCurrentMessages = (seedOlderPageCount: number): StoryMessageRecord[] =>
		Array.from({ length: currentSeedCount }, (_, index) => {
			const rowId = seedOlderPageCount + index + 1;
			if (index === 0) {
				return createMessage({
					rowId,
					from: 'Bootstrap admin',
					content: 'Welcome from transport',
				});
			}
			if (index === 1) {
				return createMessage({
					rowId,
					from: 'Analyst',
					content: 'Read ring should stay in sync.',
				});
			}
			return createMessage({
				rowId,
				from: index % 2 === 0 ? 'Bootstrap admin' : 'Analyst',
				content: `Transcript seed #${rowId}`,
			});
		});

	const createOlderPage = (seedOlderPageCount: number): StoryMessageRecord[] =>
		Array.from({ length: seedOlderPageCount }, (_, index) =>
			createMessage({
				rowId: index + 1,
				from: index % 2 === 0 ? 'Analyst' : 'Bootstrap admin',
				content: `Older history #${index + 1}`,
			}),
		);

	let storyRootRef = $state<HTMLDivElement | null>(null);
	let activeSocket = $state<StorySocket | null>(null);
	let transportAppendCount = $state(0);
	let loadedMessageCount = $state(0);
	let pageRequestCount = $state(0);
	let pendingOlderCount = $state(0);
	let latestVisibleMessage = $state<WebChatVisibleMessageFact | null>(null);
	let clientPayloadTypes = $state<string[]>([]);
	let scrollControllerRef = $state<ScrollController | null>(null);
	let seekHistoryStartButtonRef = $state<HTMLButtonElement | null>(null);
	let viewportState = $state({
		scrollTop: '',
		scrollHeight: '',
		clientHeight: '',
		atLatest: '',
		atStart: '',
		latestAffordanceVisible: '',
	});

	const rememberClientPayload = (payloadType: string): void => {
		clientPayloadTypes = [...clientPayloadTypes.slice(-7), payloadType];
	};

	class StorySocket implements WebChatSocketLike {
		readyState = 0;
		private readonly listeners = new Map<string, Array<(event: Event | MessageEvent) => void>>();
		private currentMessages: StoryMessageRecord[];
		private olderPage: StoryMessageRecord[];
		private readonly roomChannel: WebChatChannel;
		private readonly seedOlderPageCount: number;

		constructor(roomChannel: WebChatChannel, seedOlderPageCount: number) {
			this.roomChannel = roomChannel;
			this.seedOlderPageCount = seedOlderPageCount;
			this.currentMessages = createCurrentMessages(seedOlderPageCount);
			this.olderPage = createOlderPage(seedOlderPageCount);
			activeSocket = this;
			queueMicrotask(() => {
				this.readyState = 1;
				this.emit('open', new Event('open'));
				this.emitSnapshot();
			});
		}

		addEventListener(type: string, listener: (event: Event | MessageEvent) => void): void {
			const queue = this.listeners.get(type) ?? [];
			queue.push(listener);
			this.listeners.set(type, queue);
		}

		removeEventListener(type: string, listener: (event: Event | MessageEvent) => void): void {
			const queue = this.listeners.get(type) ?? [];
			this.listeners.set(
				type,
				queue.filter((entry) => entry !== listener),
			);
		}

		send(data: string): void {
			const payload = JSON.parse(data) as {
				type?: string;
				message?: { content?: string };
			};
			if (!payload.type) {
				return;
			}
			rememberClientPayload(payload.type);
			if (payload.type === 'send' && payload.message?.content) {
				this.pushLatestTransport(payload.message.content);
				return;
			}
			if (payload.type === 'page') {
				pageRequestCount += 1;
				const pageItems = this.olderPage;
				this.olderPage = [];
				this.currentMessages = [...pageItems, ...this.currentMessages];
				pendingOlderCount = 0;
				loadedMessageCount = this.currentMessages.length;
				queueMicrotask(() => {
					this.emitTransport({
						type: 'page',
						chatId: this.roomChannel.chatId,
						page: {
							items: pageItems,
							nextBefore: null,
							hasMoreBefore: false,
						},
					});
				});
			}
		}

		pushLatestTransport(content: string): void {
			const nextRowId =
				this.currentMessages.at(-1)?.rowId ?? this.seedOlderPageCount + currentSeedCount;
			const nextMessage = createMessage({
				rowId: nextRowId + 1,
				from: 'Bootstrap admin',
				content,
			});
			this.currentMessages = [...this.currentMessages, nextMessage];
			loadedMessageCount = this.currentMessages.length;
			queueMicrotask(() => {
				this.emitTransport({
					type: 'messages',
					chatId: this.roomChannel.chatId,
					headVersion: String(nextMessage.rowId),
					items: [nextMessage],
				});
			});
		}

		close(): void {
			this.readyState = 3;
			if (activeSocket === this) {
				activeSocket = null;
			}
			this.emit('close', new Event('close'));
		}

		private emitSnapshot(): void {
			loadedMessageCount = this.currentMessages.length;
			pendingOlderCount = this.olderPage.length;
			this.emitTransport({
				type: 'snapshot',
				chatId: this.roomChannel.chatId,
				snapshot: {
					channel: this.roomChannel,
					items: this.currentMessages,
					nextBefore:
						this.olderPage.length > 0
							? {
									beforeTimeMs: this.currentMessages[0]?.createdAt ?? baseTimestamp,
									beforeId: this.currentMessages[0]?.rowId ?? 0,
								}
							: null,
					hasMoreBefore: this.olderPage.length > 0,
					headVersion: String(this.currentMessages.at(-1)?.rowId ?? 0),
				},
			});
		}

		private emitTransport(message: WebChatTransportMessage): void {
			this.emit('message', new MessageEvent('message', { data: JSON.stringify(message) }));
		}

		private emit(type: string, event: Event | MessageEvent): void {
			for (const listener of this.listeners.get(type) ?? []) {
				listener(event);
			}
		}
	}

	const socketFactory: WebChatSocketFactory = () => new StorySocket(channel, olderPageCount);

	const pushTransportLatest = (): void => {
		const nextCount = transportAppendCount + 1;
		transportAppendCount = nextCount;
		activeSocket?.pushLatestTransport(`Transport append #${nextCount}`);
	};

	const waitForFrame = async (): Promise<void> =>
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

	const getViewport = (): HTMLDivElement | null => {
		const viewport = storyRootRef?.querySelector<HTMLDivElement>("[data-testid='web-chat-scroll-viewport']");
		return viewport instanceof HTMLDivElement ? viewport : null;
	};

	const refreshViewportState = (): void => {
		const viewport = getViewport();
		const timelineRoot = storyRootRef?.querySelector<HTMLElement>('.bottom-anchored-timeline-root');
		const latestAffordance = storyRootRef?.querySelector<HTMLElement>('.chat-scroll-latest');
		viewportState = {
			scrollTop: viewport ? String(Math.round(viewport.scrollTop)) : '',
			scrollHeight: viewport ? String(Math.round(viewport.scrollHeight)) : '',
			clientHeight: viewport ? String(Math.round(viewport.clientHeight)) : '',
			atLatest: timelineRoot?.dataset.atLatest ?? '',
			atStart: timelineRoot?.dataset.atStart ?? '',
			latestAffordanceVisible: latestAffordance?.dataset.visible ?? '',
		};
	};

	const settleViewport = async (viewport: HTMLDivElement): Promise<void> => {
		await waitForFrame();
		await waitForFrame();
		let lastSignature = `${viewport.scrollTop}:${viewport.scrollHeight}:${viewport.clientHeight}`;
		for (let index = 0; index < 12; index += 1) {
			await waitForFrame();
			const signature = `${viewport.scrollTop}:${viewport.scrollHeight}:${viewport.clientHeight}`;
			if (signature === lastSignature) {
				return;
			}
			lastSignature = signature;
		}
	};

	const scrollViewportTo = async (top: number): Promise<void> => {
		const viewport = getViewport();
		if (!viewport) {
			return;
		}
		viewport.scrollTo({
			top,
			left: viewport.scrollLeft,
			behavior: 'auto',
		});
		viewport.dispatchEvent(new Event('scroll', { bubbles: true }));
		await settleViewport(viewport);
		refreshViewportState();
	};

	const scrollAwayFromLatest = async (): Promise<void> => {
		const viewport = getViewport();
		if (!viewport) {
			return;
		}
		const candidateOffsets = [viewport.clientHeight * 0.4, viewport.clientHeight * 0.8, 480];
		for (const offset of candidateOffsets) {
			await scrollViewportTo(getBottomAnchoredScrollTopFromVirtualOffset(offset));
			if ((storyRootRef?.querySelector('.chat-scroll-latest') as HTMLElement | null)?.dataset.visible === 'true') {
				return;
			}
		}
		await scrollViewportTo(getBottomAnchoredStartScrollTop(viewport));
	};

	const reachHistoryStart = async (): Promise<void> => {
		const viewport = getViewport();
		if (!viewport) {
			return;
		}
		await scrollViewportTo(getBottomAnchoredStartScrollTop(viewport));
	};

	const stateJson = $derived.by(() =>
		JSON.stringify(
			{
				loadedMessageCount,
				transportAppendCount,
				pageRequestCount,
				pendingOlderCount,
				latestVisibleMessage,
				clientPayloadTypes,
				viewport: (() => {
					if (!viewportState.clientHeight) {
						return null;
					}
					return {
						scrollTop: Number(viewportState.scrollTop),
						scrollHeight: Number(viewportState.scrollHeight),
						clientHeight: Number(viewportState.clientHeight),
						atLatest: viewportState.atLatest || null,
						atStart: viewportState.atStart || null,
						latestAffordanceVisible: viewportState.latestAffordanceVisible || null,
					};
				})(),
			},
			null,
			2,
		),
	);

	$effect(() => {
		const root = storyRootRef;
		if (!root) {
			return;
		}
		refreshViewportState();
		const viewport = getViewport();
		const timelineRoot = root.querySelector<HTMLElement>('.bottom-anchored-timeline-root');
		const latestAffordance = root.querySelector<HTMLElement>('.chat-scroll-latest');
		const cleanupScroll =
			viewport instanceof HTMLDivElement
				? (() => {
						const handleScroll = (): void => {
							refreshViewportState();
						};
						viewport.addEventListener('scroll', handleScroll, { passive: true });
						return () => viewport.removeEventListener('scroll', handleScroll);
					})()
				: () => {};
		const observer =
			typeof MutationObserver === 'undefined'
				? null
				: new MutationObserver(() => {
						refreshViewportState();
					});
		if (timelineRoot) {
			observer?.observe(timelineRoot, {
				attributes: true,
				attributeFilter: ['data-at-latest', 'data-at-start'],
			});
		}
		if (latestAffordance) {
			observer?.observe(latestAffordance, {
				attributes: true,
				attributeFilter: ['data-visible'],
			});
		}
		return () => {
			cleanupScroll();
			observer?.disconnect();
		};
	});
</script>

<div
	bind:this={storyRootRef}
	class="grid h-[44rem] grid-rows-[auto_minmax(0,1fr)] gap-4 rounded-2xl border bg-background p-3"
	data-testid="web-chat-story-root"
	data-debug-at-latest={viewportState.atLatest}
	data-debug-at-start={viewportState.atStart}
	data-debug-client-height={viewportState.clientHeight}
	data-debug-latest-affordance={viewportState.latestAffordanceVisible}
	data-debug-scroll-height={viewportState.scrollHeight}
	data-debug-scroll-top={viewportState.scrollTop}
>
	<section class="grid gap-2 rounded-2xl border border-border/70 bg-background/90 px-3 py-3 shadow-sm">
		<div class="flex flex-wrap gap-2">
			<button
				class="rounded-full border px-3 py-1.5 text-sm"
				data-testid="web-chat-story-push-latest"
				onclick={pushTransportLatest}
			>
				Push latest transport
			</button>
			<button
				class="rounded-full border px-3 py-1.5 text-sm"
				data-testid="web-chat-story-scroll-away"
				onclick={scrollAwayFromLatest}
			>
				Reveal older context
			</button>
			<button
				class="rounded-full border px-3 py-1.5 text-sm"
				data-testid="web-chat-story-reach-start"
				onclick={reachHistoryStart}
			>
				Reach history start
			</button>
			<button
				bind:this={seekHistoryStartButtonRef}
				class="rounded-full border px-3 py-1.5 text-sm"
				data-testid="web-chat-story-seek-start"
			>
				Seek history start
			</button>
		</div>
		<p class="text-xs text-muted-foreground">
			Use this harness to inspect room transcript scroll ownership: push a transport append, scroll away to expose
			the latest affordance, and seek the history start to trigger older-page loading.
		</p>
	</section>

	<div
		class="web-chat-story-panels grid h-full gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"
		style="min-block-size: 0;"
	>
		<div class="web-chat-story-preview h-full rounded-2xl border bg-background p-3">
			<WebChatViewHost
				{channel}
				initialMessages={[]}
				class="h-full"
				bind:scrollControllerRef
				bind:historyStartActionRef={seekHistoryStartButtonRef}
				showHeader={false}
				onLatestVisibleMessageIdChange={(message) => {
					latestVisibleMessage = message;
				}}
				{socketFactory}
			/>
		</div>

		<aside class="web-chat-story-state-panel grid h-full rounded-2xl border bg-background p-3">
			<ScrollView class="h-full" contentClass="rounded-xl border border-border/60 bg-muted/20 p-3">
				<pre class="text-[11px] leading-5" data-testid="web-chat-story-state">{stateJson}</pre>
			</ScrollView>
		</aside>
	</div>
</div>

<style>
	.web-chat-story-panels,
	.web-chat-story-preview,
	.web-chat-story-state-panel {
		min-block-size: 0;
	}

	.web-chat-story-preview :global(.web-chat-view),
	.web-chat-story-preview :global(.chat-card),
	.web-chat-story-preview :global(.chat-scaffold),
	.web-chat-story-preview :global(.chat-body),
	.web-chat-story-preview :global(.chat-transcript-shell) {
		min-block-size: 0;
		block-size: 100%;
	}
</style>
