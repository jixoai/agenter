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
});
