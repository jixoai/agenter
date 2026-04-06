import { describe, expect, test } from 'vitest';

import {
	reconcilePinnedRunningAvatarIds,
	togglePinnedRunningAvatarId,
} from './running-avatar-rail-state';

describe('Feature: Avatar submenu pin state', () => {
	test('Scenario: Given the pinned ids already match the available sessions When reconciling Then the helper preserves the same array reference', () => {
		const currentIds = ['session-alpha', 'session-beta'];

		const reconciled = reconcilePinnedRunningAvatarIds(currentIds, [
			'session-alpha',
			'session-beta',
			'session-gamma',
		]);

		expect(reconciled).toBe(currentIds);
	});

	test('Scenario: Given a pin request that does not change the pin state When toggling Then the helper preserves the same array reference', () => {
		const currentIds = ['session-alpha'];

		const pinnedAgain = togglePinnedRunningAvatarId(currentIds, 'session-alpha', true);
		const unpinnedAgain = togglePinnedRunningAvatarId([], 'session-alpha', false);

		expect(pinnedAgain).toBe(currentIds);
		expect(unpinnedAgain).toEqual([]);
	});

	test('Scenario: Given the available sessions shrink When reconciling Then stale pins are removed from the result', () => {
		const reconciled = reconcilePinnedRunningAvatarIds(
			['session-alpha', 'session-beta'],
			['session-beta', 'session-gamma'],
		);

		expect(reconciled).toEqual(['session-beta']);
	});
});
