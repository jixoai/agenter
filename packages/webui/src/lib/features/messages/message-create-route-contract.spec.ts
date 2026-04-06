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

	test('Scenario: Given the create route leaves room titles optional When reading the route source Then the title affordance matches the Room fallback law', () => {
		expect(messageCreateRouteSource).toContain('placeholder="Room"');
		expect(messageCreateRouteSource).toContain('Optional. Leave blank to use "Room".');
		expect(messageCreateRouteSource).not.toContain('placeholder="Incident bridge"');
	});
});
