import type { RunningAvatarRailItem } from '$lib/features/runtime/runtime-shell-state';
import { describeCompactWorkspace } from '$lib/features/workspaces/workspace-sorting';

const OPEN_AVATAR_TABS_STORAGE_KEY = 'agenter:webui:avatars:open-tabs';
export const OPEN_AVATAR_TABS_CHANGE_EVENT = 'agenter:open-avatar-tabs-change';

export interface OpenAvatarTabEntry {
	id: string;
	workspacePath: string;
	workspaceName: string;
	avatarNickname: string;
	href: string;
}

const normalizeText = (value: string): string => value.trim();

export const createOpenAvatarTabId = (workspacePath: string, avatarNickname: string): string =>
	`avatar-tab:${normalizeText(workspacePath)}::${normalizeText(avatarNickname)}`;

export const buildOpenAvatarHref = (workspacePath: string, avatarNickname: string): string =>
	`/avatars/open?path=${encodeURIComponent(normalizeText(workspacePath))}&avatar=${encodeURIComponent(normalizeText(avatarNickname))}`;

export const createOpenAvatarTabEntry = (input: {
	workspacePath: string;
	avatarNickname: string;
}): OpenAvatarTabEntry => {
	const workspacePath = normalizeText(input.workspacePath);
	const avatarNickname = normalizeText(input.avatarNickname);
	return {
		id: createOpenAvatarTabId(workspacePath, avatarNickname),
		workspacePath,
		workspaceName: describeCompactWorkspace(workspacePath),
		avatarNickname,
		href: buildOpenAvatarHref(workspacePath, avatarNickname),
	};
};

const normalizeOpenAvatarTabs = (entries: readonly OpenAvatarTabEntry[]): OpenAvatarTabEntry[] => {
	const normalized: OpenAvatarTabEntry[] = [];
	const seenIds = new Set<string>();

	for (const entry of entries) {
		const workspacePath = normalizeText(entry.workspacePath);
		const avatarNickname = normalizeText(entry.avatarNickname);
		if (workspacePath.length === 0 || avatarNickname.length === 0) {
			continue;
		}
		const normalizedEntry = createOpenAvatarTabEntry({
			workspacePath,
			avatarNickname,
		});
		if (seenIds.has(normalizedEntry.id)) {
			continue;
		}
		seenIds.add(normalizedEntry.id);
		normalized.push(normalizedEntry);
	}

	return normalized;
};

const sameTabIds = (left: readonly OpenAvatarTabEntry[], right: readonly OpenAvatarTabEntry[]): boolean =>
	left.length === right.length && left.every((entry, index) => entry.id === right[index]?.id);

const emitOpenAvatarTabsChange = (): void => {
	if (typeof window === 'undefined') {
		return;
	}
	window.dispatchEvent(new CustomEvent(OPEN_AVATAR_TABS_CHANGE_EVENT));
};

export const readOpenAvatarTabs = (): OpenAvatarTabEntry[] => {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(OPEN_AVATAR_TABS_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as {
			entries?: Array<{ workspacePath?: unknown; avatarNickname?: unknown }>;
		};
		if (!Array.isArray(parsed.entries)) {
			return [];
		}
		return normalizeOpenAvatarTabs(
			parsed.entries
				.filter(
					(entry): entry is { workspacePath: string; avatarNickname: string } =>
						typeof entry?.workspacePath === 'string' && typeof entry?.avatarNickname === 'string',
				)
				.map((entry) => createOpenAvatarTabEntry(entry)),
		);
	} catch {
		return [];
	}
};

export const writeOpenAvatarTabs = (entries: readonly OpenAvatarTabEntry[]): void => {
	if (typeof window === 'undefined') {
		return;
	}
	const normalized = normalizeOpenAvatarTabs(entries);
	if (normalized.length === 0) {
		window.localStorage.removeItem(OPEN_AVATAR_TABS_STORAGE_KEY);
		emitOpenAvatarTabsChange();
		return;
	}
	window.localStorage.setItem(
		OPEN_AVATAR_TABS_STORAGE_KEY,
		JSON.stringify({
			entries: normalized.map((entry) => ({
				workspacePath: entry.workspacePath,
				avatarNickname: entry.avatarNickname,
			})),
		}),
	);
	emitOpenAvatarTabsChange();
};

export const reconcileOpenAvatarTabs = (currentEntries: OpenAvatarTabEntry[]): OpenAvatarTabEntry[] => {
	const next = normalizeOpenAvatarTabs(currentEntries);
	if (sameTabIds(currentEntries, next)) {
		return currentEntries;
	}
	writeOpenAvatarTabs(next);
	return next;
};

export const upsertOpenAvatarTab = (
	currentEntries: OpenAvatarTabEntry[],
	input: {
		workspacePath: string;
		avatarNickname: string;
	},
): { entries: OpenAvatarTabEntry[]; entry: OpenAvatarTabEntry } => {
	const normalizedCurrent = normalizeOpenAvatarTabs(currentEntries);
	const entry = createOpenAvatarTabEntry(input);
	const existing = normalizedCurrent.find((currentEntry) => currentEntry.id === entry.id);
	if (existing) {
		if (sameTabIds(currentEntries, normalizedCurrent)) {
			return { entries: currentEntries, entry: existing };
		}
		writeOpenAvatarTabs(normalizedCurrent);
		return { entries: normalizedCurrent, entry: existing };
	}
	const next = [...normalizedCurrent, entry];
	writeOpenAvatarTabs(next);
	return { entries: next, entry };
};

export const removeOpenAvatarTab = (currentEntries: OpenAvatarTabEntry[], tabId: string): OpenAvatarTabEntry[] => {
	const normalizedCurrent = normalizeOpenAvatarTabs(currentEntries);
	const next = normalizedCurrent.filter((entry) => entry.id !== tabId);
	if (sameTabIds(currentEntries, next)) {
		return currentEntries;
	}
	if (sameTabIds(normalizedCurrent, next)) {
		return next;
	}
	writeOpenAvatarTabs(next);
	return next;
};

export const resolveOpenAvatarTabFromUrl = (url: URL): OpenAvatarTabEntry | null => {
	if (url.pathname !== '/avatars/open') {
		return null;
	}
	const workspacePath = normalizeText(url.searchParams.get('path') ?? '');
	const avatarNickname = normalizeText(url.searchParams.get('avatar') ?? '');
	if (workspacePath.length === 0 || avatarNickname.length === 0) {
		return null;
	}
	return createOpenAvatarTabEntry({
		workspacePath,
		avatarNickname,
	});
};

export const extractOpenAvatarTabId = (url: URL): string | null =>
	resolveOpenAvatarTabFromUrl(url)?.id ?? null;

export const buildOpenAvatarRailItems = (
	openTabs: readonly OpenAvatarTabEntry[],
	input: {
		activeTabId: string | null;
	},
): RunningAvatarRailItem[] =>
	openTabs.map((tab) => ({
		sessionId: tab.id,
		label: tab.avatarNickname,
		workspacePath: tab.workspacePath,
		workspaceName: tab.workspaceName,
		detail: `${tab.workspaceName} · Open avatar`,
		status: null,
		unreadCount: 0,
		iconUrl: null,
		avatarPrincipalId: null,
		href: tab.href,
		active: input.activeTabId === tab.id,
		pinned: false,
		pinEnabled: false,
	}));
