import type { WorkspaceEntry } from '@agenter/client-sdk';

export type WorkspaceHistorySortMode = 'recent' | 'path' | 'name';

const workspaceDisplayName = (path: string): string => {
	const normalized = path.replace(/\/+$/u, '');
	return normalized.split('/').filter(Boolean).at(-1) ?? path;
};

export const describeWorkspace = (path: string): string => (path === '~/' ? 'Global workspace' : path);

export const sortWorkspacesForCatalog = (
	workspaces: WorkspaceEntry[],
	recentPaths: string[],
): WorkspaceEntry[] => {
	return [...workspaces].sort((left, right) => {
		if (left.path === '~/') {
			return -1;
		}
		if (right.path === '~/') {
			return 1;
		}
		if (left.favorite !== right.favorite) {
			return left.favorite ? -1 : 1;
		}
		const leftRank = recentPaths.indexOf(left.path);
		const rightRank = recentPaths.indexOf(right.path);
		if (leftRank !== rightRank) {
			if (leftRank === -1) {
				return 1;
			}
			if (rightRank === -1) {
				return -1;
			}
			return leftRank - rightRank;
		}
		return left.path.localeCompare(right.path);
	});
};

export const sortWorkspacesForHistory = (
	workspaces: WorkspaceEntry[],
	sortMode: WorkspaceHistorySortMode,
): WorkspaceEntry[] => {
	return [...workspaces].sort((left, right) => {
		if (sortMode === 'path') {
			return left.path.localeCompare(right.path);
		}
		if (sortMode === 'name') {
			return workspaceDisplayName(left.path).localeCompare(workspaceDisplayName(right.path));
		}
		const leftActivity = left.lastSessionActivityAt ?? '';
		const rightActivity = right.lastSessionActivityAt ?? '';
		if (leftActivity !== rightActivity) {
			return rightActivity.localeCompare(leftActivity);
		}
		return left.path.localeCompare(right.path);
	});
};
