import { describe, expect, test } from 'vitest';

import {
	buildSkillTreeRows,
	createSkillBrowserKey,
	mergeSkillTreePage,
	toSkillCatalogTransportRootKind,
} from './skill-browser-state';

describe('Feature: Skills browser projection helpers', () => {
	test('Scenario: Given a surface root kind When projecting transport input Then built-in maps to builtin while SKILLS_HOME stays stable', () => {
		expect(toSkillCatalogTransportRootKind('built-in')).toBe('builtin');
		expect(toSkillCatalogTransportRootKind('skills-home')).toBe('skills-home');
	});

	test('Scenario: Given an expanded directory tree When building visible rows Then descendants only appear beneath expanded ancestors', () => {
		const rows = buildSkillTreeRows({
			pages: {
				'/': {
					rootPath: '/',
					total: 2,
					nextOffset: null,
					items: [
						{
							path: '/docs',
							name: 'docs',
							kind: 'directory',
							sizeBytes: null,
							modifiedAtMs: null,
							previewKind: 'directory',
						},
						{
							path: '/SKILL.md',
							name: 'SKILL.md',
							kind: 'file',
							sizeBytes: 120,
							modifiedAtMs: 1,
							previewKind: 'text',
						},
					],
				},
				'/docs': {
					rootPath: '/docs',
					total: 1,
					nextOffset: null,
					items: [
						{
							path: '/docs/guide.md',
							name: 'guide.md',
							kind: 'file',
							sizeBytes: 88,
							modifiedAtMs: 2,
							previewKind: 'text',
						},
					],
				},
			},
			expandedPaths: new Set(['/']),
		});

		expect(rows.map((row) => (row.type === 'entry' ? row.entry.path : row.parentPath))).toEqual([
			'/docs',
			'/SKILL.md',
		]);

		const expandedRows = buildSkillTreeRows({
			pages: {
				'/': {
					rootPath: '/',
					total: 2,
					nextOffset: null,
					items: [
						{
							path: '/docs',
							name: 'docs',
							kind: 'directory',
							sizeBytes: null,
							modifiedAtMs: null,
							previewKind: 'directory',
						},
						{
							path: '/SKILL.md',
							name: 'SKILL.md',
							kind: 'file',
							sizeBytes: 120,
							modifiedAtMs: 1,
							previewKind: 'text',
						},
					],
				},
				'/docs': {
					rootPath: '/docs',
					total: 1,
					nextOffset: null,
					items: [
						{
							path: '/docs/guide.md',
							name: 'guide.md',
							kind: 'file',
							sizeBytes: 88,
							modifiedAtMs: 2,
							previewKind: 'text',
						},
					],
				},
			},
			expandedPaths: new Set(['/', '/docs']),
		});

		expect(expandedRows.map((row) => (row.type === 'entry' ? row.entry.path : row.parentPath))).toEqual([
			'/docs',
			'/docs/guide.md',
			'/SKILL.md',
		]);
	});

	test('Scenario: Given paged tree results When merging another page Then existing rows stay stable and the new rows append once', () => {
		const merged = mergeSkillTreePage(
			{
				rootPath: '/',
				total: 3,
				nextOffset: 2,
				items: [
					{
						path: '/SKILL.md',
						name: 'SKILL.md',
						kind: 'file',
						sizeBytes: 120,
						modifiedAtMs: 1,
						previewKind: 'text',
					},
				],
			},
			{
				rootPath: '/',
				total: 3,
				nextOffset: null,
				items: [
					{
						path: '/SKILL.md',
						name: 'SKILL.md',
						kind: 'file',
						sizeBytes: 120,
						modifiedAtMs: 1,
						previewKind: 'text',
					},
					{
						path: '/README.md',
						name: 'README.md',
						kind: 'file',
						sizeBytes: 80,
						modifiedAtMs: 2,
						previewKind: 'text',
					},
				],
			},
		);

		expect(merged.items.map((entry) => entry.path)).toEqual(['/SKILL.md', '/README.md']);
		expect(createSkillBrowserKey('root', 'reviewer')).toBe('root::reviewer');
	});
});
