import { describe, expect, test } from 'vitest';

import {
	createSkillAvatarTabEntry,
	removeSkillAvatarTab,
	upsertSkillAvatarTab,
	type SkillAvatarTabEntry,
} from './skill-avatar-tabs-state';

describe('Feature: Skills avatar tab presence', () => {
	test('Scenario: Given one avatar skill tab is revisited When upserting it again Then the workbench keeps one durable avatar tab entry', () => {
		const current: SkillAvatarTabEntry[] = [createSkillAvatarTabEntry('default')];

		const next = upsertSkillAvatarTab(current, 'default');

		expect(next.entry).toEqual(createSkillAvatarTabEntry('default'));
		expect(next.entries).toEqual([createSkillAvatarTabEntry('default')]);
	});

	test('Scenario: Given multiple avatar skill tabs When closing one avatar tab Then the remaining browser-style avatar tabs stay intact', () => {
		const current: SkillAvatarTabEntry[] = [
			createSkillAvatarTabEntry('default'),
			createSkillAvatarTabEntry('reviewer'),
		];

		expect(removeSkillAvatarTab(current, createSkillAvatarTabEntry('default').id)).toEqual([
			createSkillAvatarTabEntry('reviewer'),
		]);
	});
});
