// Device-local workbench projection only. Workspaces can sync as resources without syncing this open-tab strip.
export interface WorkspaceWorkbenchTabEntry {
	workspacePath: string;
	href: string;
}

const WORKSPACE_TABS_STORAGE_KEY = 'agenter:studio:workspaces:tabs';
export const WORKSPACE_TABS_CHANGE_EVENT = 'agenter:workspace-tabs-change';

const normalizeTabEntry = (entry: WorkspaceWorkbenchTabEntry): WorkspaceWorkbenchTabEntry | null => {
	const workspacePath = entry.workspacePath.trim();
	const href = entry.href.trim();
	if (workspacePath.length === 0 || href.length === 0) {
		return null;
	}
	return {
		workspacePath,
		href,
	};
};

const normalizeTabEntries = (entries: readonly WorkspaceWorkbenchTabEntry[]): WorkspaceWorkbenchTabEntry[] => {
	const seen = new Set<string>();
	const normalized: WorkspaceWorkbenchTabEntry[] = [];
	for (const entry of entries) {
		const next = normalizeTabEntry(entry);
		if (!next || seen.has(next.workspacePath)) {
			continue;
		}
		seen.add(next.workspacePath);
		normalized.push(next);
	}
	return normalized;
};

const sameEntries = (left: readonly WorkspaceWorkbenchTabEntry[], right: readonly WorkspaceWorkbenchTabEntry[]): boolean =>
	left.length === right.length &&
	left.every(
		(entry, index) =>
			entry.workspacePath === right[index]?.workspacePath && entry.href === right[index]?.href,
	);

const emitWorkspaceTabsChange = (): void => {
	if (typeof window === 'undefined') {
		return;
	}
	window.dispatchEvent(new CustomEvent(WORKSPACE_TABS_CHANGE_EVENT));
};

export const readWorkspaceWorkbenchTabs = (): WorkspaceWorkbenchTabEntry[] => {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(WORKSPACE_TABS_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as { tabs?: unknown };
		return Array.isArray(parsed.tabs)
			? normalizeTabEntries(
					parsed.tabs.filter(
						(value): value is WorkspaceWorkbenchTabEntry =>
							typeof value === 'object' &&
							value !== null &&
							'workspacePath' in value &&
							'href' in value &&
							typeof value.workspacePath === 'string' &&
							typeof value.href === 'string',
					),
				)
			: [];
	} catch {
		return [];
	}
};

export const writeWorkspaceWorkbenchTabs = (tabs: readonly WorkspaceWorkbenchTabEntry[]): void => {
	if (typeof window === 'undefined') {
		return;
	}
	const normalized = normalizeTabEntries(tabs);
	if (normalized.length === 0) {
		window.localStorage.removeItem(WORKSPACE_TABS_STORAGE_KEY);
		emitWorkspaceTabsChange();
		return;
	}
	window.localStorage.setItem(
		WORKSPACE_TABS_STORAGE_KEY,
		JSON.stringify({
			tabs: normalized,
		}),
	);
	emitWorkspaceTabsChange();
};

export const upsertWorkspaceWorkbenchTab = (
	currentTabs: WorkspaceWorkbenchTabEntry[],
	nextTab: WorkspaceWorkbenchTabEntry,
): WorkspaceWorkbenchTabEntry[] => {
	const normalizedCurrent = normalizeTabEntries(currentTabs);
	const normalizedNext = normalizeTabEntry(nextTab);
	if (!normalizedNext) {
		return currentTabs;
	}

	const existingIndex = normalizedCurrent.findIndex((tab) => tab.workspacePath === normalizedNext.workspacePath);
	const nextTabs =
		existingIndex === -1
			? [...normalizedCurrent, normalizedNext]
			: normalizedCurrent.map((tab, index) => (index === existingIndex ? normalizedNext : tab));

	if (sameEntries(currentTabs, nextTabs)) {
		return currentTabs;
	}
	if (sameEntries(normalizedCurrent, nextTabs)) {
		return nextTabs;
	}
	writeWorkspaceWorkbenchTabs(nextTabs);
	return nextTabs;
};

export const removeWorkspaceWorkbenchTab = (
	currentTabs: WorkspaceWorkbenchTabEntry[],
	workspacePath: string,
): WorkspaceWorkbenchTabEntry[] => {
	const normalizedCurrent = normalizeTabEntries(currentTabs);
	const normalizedWorkspacePath = workspacePath.trim();
	const nextTabs = normalizedCurrent.filter((tab) => tab.workspacePath !== normalizedWorkspacePath);

	if (sameEntries(currentTabs, nextTabs)) {
		return currentTabs;
	}
	if (sameEntries(normalizedCurrent, nextTabs)) {
		return nextTabs;
	}
	writeWorkspaceWorkbenchTabs(nextTabs);
	return nextTabs;
};
