// Device-local workbench projection only. Cross-device sync belongs to the underlying resource, not this tab strip.
const AVATAR_SESSION_TABS_STORAGE_KEY = 'agenter:studio:avatars:session-tabs';
export const AVATAR_SESSION_TABS_CHANGE_EVENT = 'agenter:avatar-session-tabs-change';

const normalizeIds = (ids: readonly string[]): string[] =>
	[...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];

const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
	left.length === right.length && left.every((value, index) => value === right[index]);

const emitAvatarSessionTabsChange = (): void => {
	if (typeof window === 'undefined') {
		return;
	}
	window.dispatchEvent(new CustomEvent(AVATAR_SESSION_TABS_CHANGE_EVENT));
};

export const readAvatarSessionTabIds = (): string[] => {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(AVATAR_SESSION_TABS_STORAGE_KEY);
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

export const writeAvatarSessionTabIds = (ids: readonly string[]): void => {
	if (typeof window === 'undefined') {
		return;
	}
	const normalized = normalizeIds(ids);
	if (normalized.length === 0) {
		window.localStorage.removeItem(AVATAR_SESSION_TABS_STORAGE_KEY);
		emitAvatarSessionTabsChange();
		return;
	}
	window.localStorage.setItem(
		AVATAR_SESSION_TABS_STORAGE_KEY,
		JSON.stringify({
			ids: normalized,
		}),
	);
	emitAvatarSessionTabsChange();
};

export const reconcileAvatarSessionTabIds = (currentIds: string[]): string[] => {
	const next = normalizeIds(currentIds);
	if (sameIds(currentIds, next)) {
		return currentIds;
	}
	writeAvatarSessionTabIds(next);
	return next;
};

export const upsertAvatarSessionTabId = (currentIds: string[], sessionId: string): string[] => {
	const normalizedCurrent = normalizeIds(currentIds);
	const normalizedSessionId = sessionId.trim();
	if (normalizedSessionId.length === 0) {
		return currentIds;
	}
	const next = normalizedCurrent.includes(normalizedSessionId)
		? normalizedCurrent
		: [...normalizedCurrent, normalizedSessionId];

	if (sameIds(currentIds, next)) {
		return currentIds;
	}
	if (sameIds(normalizedCurrent, next)) {
		return next;
	}
	writeAvatarSessionTabIds(next);
	return next;
};

export const removeAvatarSessionTabId = (currentIds: string[], sessionId: string): string[] => {
	const normalizedCurrent = normalizeIds(currentIds);
	const normalizedSessionId = sessionId.trim();
	const next = normalizedCurrent.filter((currentId) => currentId !== normalizedSessionId);

	if (sameIds(currentIds, next)) {
		return currentIds;
	}
	if (sameIds(normalizedCurrent, next)) {
		return next;
	}
	writeAvatarSessionTabIds(next);
	return next;
};
