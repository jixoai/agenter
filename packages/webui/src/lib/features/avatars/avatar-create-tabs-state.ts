// Device-local workbench projection only. The draft resource is durable; this tab strip is not.
export interface AvatarCreateTabEntry {
	draftId: string;
	href: string;
	draftNickname: string;
	sourceAvatarNickname: string;
}

const AVATAR_CREATE_TABS_STORAGE_KEY = 'agenter:webui:avatars:create-tabs';
export const AVATAR_CREATE_TABS_CHANGE_EVENT = 'agenter:avatar-create-tabs-change';

const normalizeEntry = (entry: AvatarCreateTabEntry): AvatarCreateTabEntry | null => {
	const draftId = entry.draftId.trim();
	const href = entry.href.trim();
	if (draftId.length === 0 || href.length === 0) {
		return null;
	}
	return {
		draftId,
		href,
		draftNickname: entry.draftNickname.trim(),
		sourceAvatarNickname: entry.sourceAvatarNickname.trim(),
	};
};

const normalizeEntries = (entries: readonly AvatarCreateTabEntry[]): AvatarCreateTabEntry[] => {
	const seen = new Set<string>();
	const normalized: AvatarCreateTabEntry[] = [];
	for (const entry of entries) {
		const next = normalizeEntry(entry);
		if (!next || seen.has(next.draftId)) {
			continue;
		}
		seen.add(next.draftId);
		normalized.push(next);
	}
	return normalized;
};

const sameEntries = (left: readonly AvatarCreateTabEntry[], right: readonly AvatarCreateTabEntry[]): boolean =>
	left.length === right.length &&
	left.every(
		(entry, index) =>
			entry.draftId === right[index]?.draftId &&
			entry.href === right[index]?.href &&
			entry.draftNickname === right[index]?.draftNickname &&
			entry.sourceAvatarNickname === right[index]?.sourceAvatarNickname,
	);

const emitChange = (): void => {
	if (typeof window === 'undefined') {
		return;
	}
	window.dispatchEvent(new CustomEvent(AVATAR_CREATE_TABS_CHANGE_EVENT));
};

export const readAvatarCreateTabs = (): AvatarCreateTabEntry[] => {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(AVATAR_CREATE_TABS_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as { tabs?: unknown };
		return Array.isArray(parsed.tabs)
			? normalizeEntries(
					parsed.tabs.filter(
						(value): value is AvatarCreateTabEntry =>
							typeof value === 'object' &&
							value !== null &&
							'draftId' in value &&
							'href' in value &&
							'draftNickname' in value &&
							'sourceAvatarNickname' in value &&
							typeof value.draftId === 'string' &&
							typeof value.href === 'string' &&
							typeof value.draftNickname === 'string' &&
							typeof value.sourceAvatarNickname === 'string',
					),
				)
			: [];
	} catch {
		return [];
	}
};

export const writeAvatarCreateTabs = (tabs: readonly AvatarCreateTabEntry[]): void => {
	if (typeof window === 'undefined') {
		return;
	}
	const normalized = normalizeEntries(tabs);
	if (normalized.length === 0) {
		window.localStorage.removeItem(AVATAR_CREATE_TABS_STORAGE_KEY);
		emitChange();
		return;
	}
	window.localStorage.setItem(AVATAR_CREATE_TABS_STORAGE_KEY, JSON.stringify({ tabs: normalized }));
	emitChange();
};

export const upsertAvatarCreateTab = (
	currentTabs: AvatarCreateTabEntry[],
	nextTab: AvatarCreateTabEntry,
): AvatarCreateTabEntry[] => {
	const normalizedCurrent = normalizeEntries(currentTabs);
	const normalizedNext = normalizeEntry(nextTab);
	if (!normalizedNext) {
		return currentTabs;
	}
	const existingIndex = normalizedCurrent.findIndex((entry) => entry.draftId === normalizedNext.draftId);
	const nextTabs =
		existingIndex === -1
			? [...normalizedCurrent, normalizedNext]
			: normalizedCurrent.map((entry, index) => (index === existingIndex ? normalizedNext : entry));
	if (sameEntries(currentTabs, nextTabs)) {
		return currentTabs;
	}
	if (sameEntries(normalizedCurrent, nextTabs)) {
		return nextTabs;
	}
	writeAvatarCreateTabs(nextTabs);
	return nextTabs;
};

export const removeAvatarCreateTab = (
	currentTabs: AvatarCreateTabEntry[],
	draftId: string,
): AvatarCreateTabEntry[] => {
	const normalizedCurrent = normalizeEntries(currentTabs);
	const normalizedDraftId = draftId?.trim?.() ?? '';
	if (normalizedDraftId.length === 0) {
		return currentTabs;
	}
	const nextTabs = normalizedCurrent.filter((entry) => entry.draftId !== normalizedDraftId);
	if (sameEntries(currentTabs, nextTabs)) {
		return currentTabs;
	}
	if (sameEntries(normalizedCurrent, nextTabs)) {
		return nextTabs;
	}
	writeAvatarCreateTabs(nextTabs);
	return nextTabs;
};
