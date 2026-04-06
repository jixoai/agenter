import { describe, expect, test } from 'vitest';

import {
	buildOpenAvatarHref,
	createOpenAvatarTabEntry,
	extractOpenAvatarTabId,
	reconcileOpenAvatarTabs,
	removeOpenAvatarTab,
	resolveOpenAvatarTabFromUrl,
	upsertOpenAvatarTab,
} from './avatar-open-tabs-state';

describe('Feature: Open avatar workbench tabs', () => {
	test('Scenario: Given an avatar open request When upserting the same avatar twice Then the tab list stays stable and deduplicated', () => {
		const first = upsertOpenAvatarTab([], {
			workspacePath: '/repo/demo',
			avatarNickname: 'helper',
		});
		const second = upsertOpenAvatarTab(first.entries, {
			workspacePath: '/repo/demo',
			avatarNickname: 'helper',
		});

		expect(first.entry.href).toBe('/avatars/open?path=%2Frepo%2Fdemo&avatar=helper');
		expect(second.entries).toBe(first.entries);
		expect(second.entries).toHaveLength(1);
	});

	test('Scenario: Given an avatar open route When resolving from the URL Then the tab id and href stay deterministic', () => {
		const url = new URL(buildOpenAvatarHref('/repo/demo', 'helper'), 'http://localhost:5173');
		const entry = resolveOpenAvatarTabFromUrl(url);

		expect(entry).toEqual(
			createOpenAvatarTabEntry({
				workspacePath: '/repo/demo',
				avatarNickname: 'helper',
			}),
		);
		expect(extractOpenAvatarTabId(url)).toBe(entry?.id);
	});

	test('Scenario: Given open avatar tabs are reconciled and closed When invalid entries are removed Then only valid tabs remain', () => {
		const entry = createOpenAvatarTabEntry({
			workspacePath: '/repo/demo',
			avatarNickname: 'helper',
		});
		const reconciled = reconcileOpenAvatarTabs([
			entry,
			{ ...entry, id: 'stale' },
			createOpenAvatarTabEntry({
				workspacePath: '',
				avatarNickname: 'broken',
			}),
		]);
		const next = removeOpenAvatarTab(reconciled, entry.id);

		expect(reconciled).toEqual([entry]);
		expect(next).toEqual([]);
	});
});
