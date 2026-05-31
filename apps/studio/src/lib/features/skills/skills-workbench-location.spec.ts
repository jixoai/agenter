import { describe, expect, test } from 'vitest';

import {
	buildSkillAvatarHref,
	buildSkillsCatalogHref,
	normalizeSkillsCatalogView,
	readSkillsAvatarNickname,
	readSkillsCatalogView,
} from './skills-workbench-location';

describe('Feature: Skills workbench route contract', () => {
	test('Scenario: Given no explicit catalog query When building or reading the catalog route Then SKILLS_HOME stays the fixed default', () => {
		expect(buildSkillsCatalogHref()).toBe('/skills');
		expect(buildSkillsCatalogHref({ view: 'built-in' })).toBe('/skills?view=built-in');
		expect(readSkillsCatalogView(new URLSearchParams())).toBe('skills-home');
		expect(normalizeSkillsCatalogView('unknown')).toBe('skills-home');
	});

	test('Scenario: Given avatar overview state When building the catalog href Then the route preserves avatar selection only for the avatars page-tab', () => {
		expect(buildSkillsCatalogHref({ view: 'avatars', avatar: 'reviewer' })).toBe('/skills?view=avatars&avatar=reviewer');
		expect(buildSkillsCatalogHref({ view: 'skills-home', avatar: 'reviewer' })).toBe('/skills');
		expect(readSkillsAvatarNickname(new URLSearchParams('view=avatars&avatar=reviewer'))).toBe('reviewer');
	});

	test('Scenario: Given legacy query keys When normalizing the catalog view Then the route canonicalizes to current tabs', () => {
		expect(normalizeSkillsCatalogView('avatar')).toBe('avatars');
		expect(normalizeSkillsCatalogView('shared')).toBe('skills-home');
		expect(normalizeSkillsCatalogView('global')).toBe('skills-home');
	});

	test('Scenario: Given an avatar nickname When opening a dedicated avatar skill tab Then the route uses the durable avatar path', () => {
		expect(buildSkillAvatarHref('reviewer')).toBe('/skills/avatar/reviewer');
	});
});
