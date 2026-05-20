import type {
	SkillAvatarPreviewOutput,
	SkillAvatarTreeOutput,
	SkillCatalogEntry,
	SkillPreviewOutput,
	SkillTreeEntry,
	SkillTreeOutput,
} from '@agenter/client-sdk';

export type SkillCatalogSurfaceRootKind = 'built-in' | 'shared' | 'global';
export type SkillCatalogTransportRootKind = 'builtin' | 'shared' | 'global';
export type SkillPreviewRecord = SkillPreviewOutput | SkillAvatarPreviewOutput;
export type SkillTreePage = SkillTreeOutput | SkillAvatarTreeOutput;
export type SkillTreePages = Record<string, SkillTreePage>;

export interface SkillBrowserSection {
	id: string;
	title: string;
	description: string;
	skills: SkillCatalogEntry[];
}

export interface SkillTreeEntryRow {
	type: 'entry';
	entry: SkillTreeEntry;
	depth: number;
}

export interface SkillTreeLoadMoreRow {
	type: 'load-more';
	parentPath: string;
	remainingCount: number;
	depth: number;
}

export type SkillTreeRow = SkillTreeEntryRow | SkillTreeLoadMoreRow;

const normalizeRelativePath = (value: string | null | undefined): string => {
	const normalized = (value ?? '/').replace(/\\/gu, '/').trim();
	if (!normalized || normalized === '.') {
		return '/';
	}
	const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
	return prefixed.replace(/\/+/gu, '/').replace(/\/$/u, '') || '/';
};

const resolveDepth = (path: string): number =>
	Math.max(0, normalizeRelativePath(path).split('/').filter(Boolean).length - 1);

export const toSkillCatalogTransportRootKind = (
	rootKind: SkillCatalogSurfaceRootKind,
): SkillCatalogTransportRootKind => {
	return rootKind === 'built-in' ? 'builtin' : rootKind;
};

export const createSkillBrowserKey = (sectionId: string, skillName: string): string => `${sectionId}::${skillName}`;

export const buildSkillTreeRows = (input: {
	pages: SkillTreePages;
	expandedPaths: ReadonlySet<string>;
	rootPath?: string;
}): SkillTreeRow[] => {
	const rootPath = normalizeRelativePath(input.rootPath ?? '/');
	const rows: SkillTreeRow[] = [];

	const visit = (parentPath: string): void => {
		const page = input.pages[parentPath];
		if (!page) {
			return;
		}
		for (const entry of page.items) {
			rows.push({
				type: 'entry',
				entry,
				depth: resolveDepth(entry.path),
			});
			if (entry.kind === 'directory' && input.expandedPaths.has(entry.path)) {
				visit(entry.path);
			}
		}
		if (page.nextOffset !== null) {
			rows.push({
				type: 'load-more',
				parentPath,
				remainingCount: Math.max(0, page.total - page.nextOffset),
				depth: parentPath === '/' ? 0 : resolveDepth(parentPath) + 1,
			});
		}
	};

	visit(rootPath);
	return rows;
};

export const mergeSkillTreePage = (currentPage: SkillTreePage | undefined, nextPage: SkillTreePage): SkillTreePage => {
	if (!currentPage || currentPage.rootPath !== nextPage.rootPath) {
		return nextPage;
	}
	const seenPaths = new Set(currentPage.items.map((item) => item.path));
	return {
		...nextPage,
		items: [...currentPage.items, ...nextPage.items.filter((item) => !seenPaths.has(item.path))],
	};
};

export const formatSkillSize = (sizeBytes: number | null | undefined): string => {
	if (!sizeBytes || sizeBytes <= 0) {
		return '0 B';
	}
	if (sizeBytes < 1024) {
		return `${sizeBytes} B`;
	}
	if (sizeBytes < 1024 * 1024) {
		return `${(sizeBytes / 1024).toFixed(1)} KB`;
	}
	return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatSkillTimestamp = (timestampMs: number | null | undefined): string => {
	if (!timestampMs || Number.isNaN(timestampMs)) {
		return 'Unknown';
	}
	return new Date(timestampMs).toLocaleString();
};
