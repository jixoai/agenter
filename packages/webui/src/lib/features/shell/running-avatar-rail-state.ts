const RUNNING_AVATAR_PIN_STORAGE_KEY = 'agenter:webui:sidebar:avatars:pinned';

const normalizeIds = (ids: readonly string[]): string[] =>
	[...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];

const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
	left.length === right.length && left.every((value, index) => value === right[index]);

export const readPinnedRunningAvatarIds = (): string[] => {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(RUNNING_AVATAR_PIN_STORAGE_KEY);
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

export const writePinnedRunningAvatarIds = (ids: readonly string[]): void => {
	if (typeof window === 'undefined') {
		return;
	}
	const normalized = normalizeIds(ids);
	if (normalized.length === 0) {
		window.localStorage.removeItem(RUNNING_AVATAR_PIN_STORAGE_KEY);
		return;
	}
	window.localStorage.setItem(
		RUNNING_AVATAR_PIN_STORAGE_KEY,
		JSON.stringify({
			ids: normalized,
		}),
	);
};

export const togglePinnedRunningAvatarId = (
	currentIds: string[],
	sessionId: string,
	nextPinned?: boolean,
): string[] => {
	const normalizedCurrent = normalizeIds(currentIds);
	const isPinned = normalizedCurrent.includes(sessionId);
	const shouldPin = nextPinned ?? !isPinned;
	const next = shouldPin
		? normalizeIds([...normalizedCurrent, sessionId])
		: normalizeIds(normalizedCurrent.filter((currentId) => currentId !== sessionId));

	if (sameIds(currentIds, next)) {
		return currentIds;
	}
	if (sameIds(normalizedCurrent, next)) {
		return next;
	}
	writePinnedRunningAvatarIds(next);
	return next;
};

export const reconcilePinnedRunningAvatarIds = (
	currentIds: string[],
	availableIds: readonly string[],
): string[] => {
	const available = new Set(normalizeIds(availableIds));
	const normalizedCurrent = normalizeIds(currentIds);
	const next = normalizeIds(normalizedCurrent.filter((id) => available.has(id)));

	if (sameIds(currentIds, next)) {
		return currentIds;
	}
	if (sameIds(normalizedCurrent, next)) {
		return next;
	}
	writePinnedRunningAvatarIds(next);
	return next;
};
