import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const messageRoomRouteSource = readFileSync(resolve(import.meta.dirname, 'message-room-route.svelte'), 'utf8');

describe('Feature: Room route hydration stability contract', () => {
	test('Scenario: Given room read progress mutates frequently When reading the route source Then room hydration depends on stable chatId and accessToken primitives instead of the whole projection object', () => {
		expect(messageRoomRouteSource).toContain("const selectedRoomChatId = $derived(selectedRoomProjection?.chatId ?? '');");
		expect(messageRoomRouteSource).toContain('const selectedRoomAccessToken = $derived(selectedRoomProjection?.accessToken ?? null);');
		expect(messageRoomRouteSource).toContain('const chatId = selectedRoomChatId;');
		expect(messageRoomRouteSource).toContain('const accessToken = selectedRoomAccessToken;');
		expect(messageRoomRouteSource).toContain('void controller.runtimeStore.hydrateGlobalRoomSnapshot({');
		expect(messageRoomRouteSource).toContain('void controller.runtimeStore.hydrateGlobalRoomGrants({');
		expect(messageRoomRouteSource).toContain('void controller.runtimeStore.hydrateGlobalRoomAssets({');
		expect(messageRoomRouteSource).toContain('\t\t\taccessToken,\n\t\t\tlimit: 120,');
	});

	test('Scenario: Given the viewer changes while the transcript stays on the same latest message When reading the route source Then the route caches that visibility fact and replays read-ack work for the new viewer', () => {
		expect(messageRoomRouteSource).toContain('let latestVisibleMessageByRoomId = $state<Record<string, WebChatVisibleMessageFact | null>>({});');
		expect(messageRoomRouteSource).toContain('let latestVisibleReplayKeyByRoomId = $state<Record<string, string>>({});');
		expect(messageRoomRouteSource).toContain('const buildVisibleReplayKey = (viewerActorId: string, visibleMessage: WebChatVisibleMessageFact): string =>');
		expect(messageRoomRouteSource).toContain('const resolveLatestReplayVisibleMessage = (');
		expect(messageRoomRouteSource).toContain('const selectedViewerAccessToken = $derived.by(() => {');
		expect(messageRoomRouteSource).toContain('const messageId = room.readProgress?.latestVisibleMessageId;');
		expect(messageRoomRouteSource).toContain('const rowId = room.readProgress?.latestVisibleMessageRowId;');
		expect(messageRoomRouteSource).toContain('[room.chatId]: visibleMessage,');
		expect(messageRoomRouteSource).toContain('if (!room || !viewerActorId || !viewerAccessToken) {');
		expect(messageRoomRouteSource).toContain('void handleLatestVisibleMessageIdChange(latestVisibleMessage);');
	});
});
