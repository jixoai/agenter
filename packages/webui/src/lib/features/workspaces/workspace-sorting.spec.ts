import type { WorkspaceEntry } from '@agenter/client-sdk';
import { describe, expect, test } from 'vitest';

import { describeWorkspace, sortWorkspacesForCatalog, sortWorkspacesForHistory } from './workspace-sorting';

const makeWorkspace = (input: {
	path: string;
	favorite?: boolean;
	group?: string;
	lastSessionActivityAt?: string;
	counts?: WorkspaceEntry['counts'];
}): WorkspaceEntry => ({
	path: input.path,
	favorite: input.favorite ?? false,
	group: input.group ?? 'Other',
	missing: false,
	counts: input.counts ?? {
		all: 0,
		running: 0,
		stopped: 0,
		archive: 0,
	},
	lastSessionActivityAt: input.lastSessionActivityAt,
});

describe('Feature: Workspace sorting', () => {
	test('Scenario: Given catalog workspaces When sorting for quick start Then global, favorites, and recent workspaces stay ahead of the rest', () => {
		const workspaces = [
			makeWorkspace({ path: '/repo/beta', favorite: true }),
			makeWorkspace({ path: '/repo/alpha' }),
			makeWorkspace({ path: '~/', group: 'Global', lastSessionActivityAt: '2026-04-01T00:00:00.000Z' }),
		];

		expect(sortWorkspacesForCatalog(workspaces, ['/repo/alpha', '/repo/beta']).map((workspace) => workspace.path)).toEqual([
			'~/',
			'/repo/beta',
			'/repo/alpha',
		]);
	});

	test('Scenario: Given history sort modes When sorting Then recent, path, and display name order all remain deterministic', () => {
		const workspaces = [
			makeWorkspace({ path: '/repo/zeta', lastSessionActivityAt: '2026-03-01T00:00:00.000Z' }),
			makeWorkspace({ path: '/repo/alpha', lastSessionActivityAt: '2026-04-01T00:00:00.000Z' }),
			makeWorkspace({ path: '~/'}),
		];

		expect(sortWorkspacesForHistory(workspaces, 'recent').map((workspace) => workspace.path)).toEqual([
			'/repo/alpha',
			'/repo/zeta',
			'~/',
		]);
		expect(sortWorkspacesForHistory(workspaces, 'path').map((workspace) => workspace.path)).toEqual([
			'/repo/alpha',
			'/repo/zeta',
			'~/',
		]);
		expect(sortWorkspacesForHistory(workspaces, 'name').map((workspace) => workspace.path)).toEqual([
			'~/',
			'/repo/alpha',
			'/repo/zeta',
		]);
		expect(describeWorkspace('~/')).toBe('Global workspace');
	});
});
