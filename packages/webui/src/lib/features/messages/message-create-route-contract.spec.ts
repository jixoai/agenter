import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const messageCreateRouteSource = readFileSync(resolve(import.meta.dirname, 'message-create-route.svelte'), 'utf8');

describe('Feature: New room route navigation contract', () => {
	test('Scenario: Given room creation resolves with a durable room id When reading the create route source Then navigation uses the returned chatId instead of reconstructing a title slug', () => {
		expect(messageCreateRouteSource).toContain('const created = await controller.runtimeStore.createGlobalRoom({');
		expect(messageCreateRouteSource).toContain('await goto(`/messages/room/${encodeURIComponent(created.chatId)}`, {');
		expect(messageCreateRouteSource).not.toContain('title.trim().toLowerCase()');
		expect(messageCreateRouteSource).not.toContain('room-${');
	});
});
