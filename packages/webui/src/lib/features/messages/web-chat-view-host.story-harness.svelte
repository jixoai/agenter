<script lang="ts">
	import type {
		WebChatChannel,
		WebChatSocketFactory,
		WebChatSocketLike,
		WebChatTransportMessage,
	} from '@agenter/web-chat-view';
	import { WebChatViewHost } from '@agenter/web-chat-view';

	class StorySocket implements WebChatSocketLike {
		static nextRowId = 3;

		readyState = 0;
		private readonly listeners = new Map<string, Array<(event: Event | MessageEvent) => void>>();
		private readonly roomChannel: WebChatChannel;

		constructor(roomChannel: WebChatChannel) {
			this.roomChannel = roomChannel;
			queueMicrotask(() => {
				this.readyState = 1;
				this.emit('open', new Event('open'));
				this.emitTransport({
					type: 'snapshot',
					chatId: roomChannel.chatId,
					snapshot: {
						channel: roomChannel,
						items: [
							{
								rowId: 1,
								messageId: 'msg-1',
								chatId: roomChannel.chatId,
								from: 'Bootstrap admin',
								kind: 'text',
								content: 'Welcome from transport',
								createdAt: 1_710_000_000_000,
								updatedAt: 1_710_000_000_000,
								visibleAt: 1_710_000_000_000,
								readActorIds: [],
								unreadActorIds: [],
								metadata: {},
								attachments: [],
							},
							{
								rowId: 2,
								messageId: 'msg-2',
								chatId: roomChannel.chatId,
								from: 'Analyst',
								kind: 'text',
								content: 'Read ring should stay in sync.',
								createdAt: 1_710_000_001_000,
								updatedAt: 1_710_000_001_000,
								visibleAt: 1_710_000_001_000,
								readActorIds: [],
								unreadActorIds: [],
								metadata: {},
								attachments: [],
							},
						],
						nextBefore: null,
						hasMoreBefore: false,
						headVersion: '2',
					},
				});
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
			const payload = JSON.parse(data) as { type?: string; message?: { content?: string } };
			if (payload.type !== 'send' || !payload.message?.content) {
				return;
			}
			const rowId = StorySocket.nextRowId++;
			const messageId = `msg-${rowId}`;
			this.emitTransport({
				type: 'messages',
				chatId: this.roomChannel.chatId,
				headVersion: String(rowId),
				items: [
					{
						rowId,
						messageId,
						chatId: this.roomChannel.chatId,
						from: 'Bootstrap admin',
						kind: 'text',
						content: payload.message.content,
						createdAt: 1_710_000_000_000 + rowId * 1_000,
						updatedAt: 1_710_000_000_000 + rowId * 1_000,
						visibleAt: 1_710_000_000_000 + rowId * 1_000,
						readActorIds: [],
						unreadActorIds: [],
						metadata: {},
						attachments: [],
					},
				],
			});
		}

		close(): void {
			this.readyState = 3;
			this.emit('close', new Event('close'));
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

	const channel = {
		chatId: 'room-story',
		kind: 'room',
		title: 'Operator room',
		owner: 'root',
		participants: [
			{ id: 'system:trusted-bootstrap', label: 'Bootstrap admin' },
			{ id: 'auth:analyst', label: 'Analyst' },
		],
		createdAt: 1_710_000_000_000,
		updatedAt: 1_710_000_001_000,
		focused: true,
		accessRole: 'admin',
		accessToken: 'room-token-admin',
		participantId: 'system:trusted-bootstrap',
		currentAdmin: true,
		transportUrl: 'ws://storybook.local/room-story?token=room-token-admin',
	} satisfies WebChatChannel;

	const socketFactory: WebChatSocketFactory = () => new StorySocket(channel);

</script>

<div class="h-[44rem] rounded-2xl border bg-background p-3">
	<WebChatViewHost
		{channel}
		initialMessages={[]}
		class="h-full"
		showHeader={false}
		{socketFactory}
	/>
</div>
