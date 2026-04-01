import { describe, expect, test } from 'vitest';

import { resolveAgenterWsUrl } from './ws-url';

describe('Feature: Agenter websocket endpoint resolution', () => {
	test('Scenario: Given a configured public websocket url When resolving Then the /trpc endpoint is preserved exactly once', () => {
		expect(resolveAgenterWsUrl({ publicWsUrl: 'ws://127.0.0.1:4580' })).toBe('ws://127.0.0.1:4580/trpc');
		expect(resolveAgenterWsUrl({ publicWsUrl: 'ws://127.0.0.1:4580/trpc/' })).toBe(
			'ws://127.0.0.1:4580/trpc',
		);
	});

	test('Scenario: Given a browser location fallback When resolving Then protocol, pathname, search, and hash are normalized for trpc websocket transport', () => {
		expect(
			resolveAgenterWsUrl({
				locationHref: 'https://example.test/workspaces?path=%7E%2F#settings',
				publicWsUrl: '',
			}),
		).toBe('wss://example.test/trpc');
	});
});
