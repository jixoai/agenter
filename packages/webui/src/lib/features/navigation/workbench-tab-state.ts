export type WorkbenchTabDomain = 'avatars-runtime' | 'messages' | 'terminals';

const WORKBENCH_TAB_STORAGE_PREFIX = 'agenter:webui:workbench-tabs:dismissed:';

const normalizeIds = (ids: readonly string[]): string[] =>
	[...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];

const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
	left.length === right.length && left.every((value, index) => value === right[index]);

const storageKey = (domain: WorkbenchTabDomain): string => `${WORKBENCH_TAB_STORAGE_PREFIX}${domain}`;

export const readDismissedWorkbenchTabIds = (domain: WorkbenchTabDomain): string[] => {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(storageKey(domain));
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as { ids?: unknown };
		return Array.isArray(parsed.ids)
			? normalizeIds(parsed.ids.filter((value): value is string => typeof value === 'string'))
			: [];
	} catch {
		return [];
	}
};

export const writeDismissedWorkbenchTabIds = (domain: WorkbenchTabDomain, ids: readonly string[]): void => {
	if (typeof window === 'undefined') {
		return;
	}
	const normalized = normalizeIds(ids);
	if (normalized.length === 0) {
		window.localStorage.removeItem(storageKey(domain));
		return;
	}
	window.localStorage.setItem(
		storageKey(domain),
		JSON.stringify({
			ids: normalized,
		}),
	);
};

export const dismissWorkbenchTabId = (
	domain: WorkbenchTabDomain,
	currentIds: string[],
	id: string,
): string[] => {
	const next = normalizeIds([...currentIds, id]);
	if (sameIds(currentIds, next)) {
		return currentIds;
	}
	writeDismissedWorkbenchTabIds(domain, next);
	return next;
};

export const restoreWorkbenchTabId = (
	domain: WorkbenchTabDomain,
	currentIds: string[],
	id: string | null | undefined,
): string[] => {
	if (!id) {
		const next = normalizeIds(currentIds);
		return sameIds(currentIds, next) ? currentIds : next;
	}
	const next = normalizeIds(currentIds.filter((currentId) => currentId !== id));
	if (sameIds(currentIds, next)) {
		return currentIds;
	}
	writeDismissedWorkbenchTabIds(domain, next);
	return next;
};

export const filterDismissedWorkbenchTabs = <T>(
	items: readonly T[],
	getId: (item: T) => string,
	dismissedIds: readonly string[],
): T[] => {
	const dismissedSet = new Set(normalizeIds(dismissedIds));
	return items.filter((item) => !dismissedSet.has(getId(item)));
};

export const resolveAdjacentWorkbenchTab = <T>(
	items: readonly T[],
	getId: (item: T) => string,
	closedId: string,
): T | null => {
	const currentIndex = items.findIndex((item) => getId(item) === closedId);
	if (currentIndex === -1) {
		return items[0] ?? null;
	}
	const remaining = items.filter((item) => getId(item) !== closedId);
	return remaining[currentIndex] ?? remaining[currentIndex - 1] ?? null;
};
