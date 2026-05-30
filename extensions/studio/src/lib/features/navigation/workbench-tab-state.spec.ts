import { describe, expect, test } from 'vitest';

import {
	dismissWorkbenchTabId,
	filterDismissedWorkbenchTabs,
	restoreWorkbenchTabId,
	resolveAdjacentWorkbenchTab,
} from './workbench-tab-state';

describe('Feature: Workbench tab presence state', () => {
	test('Scenario: Given dismissed tab ids When filtering workbench resources Then only visible resources remain', () => {
		const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as const;

		expect(filterDismissedWorkbenchTabs(items, (item) => item.id, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }]);
	});

	test('Scenario: Given an active tab is closed When resolving adjacency Then the nearest remaining tab is selected', () => {
		const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as const;

		expect(resolveAdjacentWorkbenchTab(items, (item) => item.id, 'b')).toEqual({ id: 'c' });
		expect(resolveAdjacentWorkbenchTab(items, (item) => item.id, 'c')).toEqual({ id: 'b' });
		expect(resolveAdjacentWorkbenchTab(items, (item) => item.id, 'missing')).toEqual({ id: 'a' });
	});

	test('Scenario: Given an already-restored tab When restoring workbench presence Then the dismissed id array keeps the same reference', () => {
		const dismissed = ['room-a'];

		expect(restoreWorkbenchTabId('messages', dismissed, 'room-b')).toBe(dismissed);
		expect(dismissWorkbenchTabId('messages', dismissed, 'room-a')).toBe(dismissed);
	});
});
