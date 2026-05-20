import { describe, expect, test } from 'vitest';

import {
	reconcileAvatarSessionTabIds,
	removeAvatarSessionTabId,
	upsertAvatarSessionTabId,
} from './avatar-session-tabs-state';

describe('Feature: Avatar session workbench tabs', () => {
	test('Scenario: Given the same avatar session is opened twice When upserting its session id Then the tab list stays stable and deduplicated', () => {
		const first = upsertAvatarSessionTabId([], 'session-helper');
		const second = upsertAvatarSessionTabId(first, 'session-helper');

		expect(first).toEqual(['session-helper']);
		expect(second).toBe(first);
	});

	test('Scenario: Given invalid avatar session ids and a close request When reconciling and removing Then only valid session ids remain', () => {
		const reconciled = reconcileAvatarSessionTabIds(['session-alpha', '  ', 'session-alpha', 'session-beta']);
		const next = removeAvatarSessionTabId(reconciled, 'session-alpha');

		expect(reconciled).toEqual(['session-alpha', 'session-beta']);
		expect(next).toEqual(['session-beta']);
	});
});
