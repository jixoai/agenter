export const normalizePinnedRunningAvatarIds = (ids: readonly string[]): string[] =>
	[...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];

const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
	left.length === right.length && left.every((value, index) => value === right[index]);

export const togglePinnedRunningAvatarId = (
	currentIds: string[],
	sessionId: string,
	nextPinned?: boolean,
): string[] => {
	const normalizedCurrent = normalizePinnedRunningAvatarIds(currentIds);
	const normalizedSessionId = sessionId.trim();
	if (normalizedSessionId.length === 0) {
		return currentIds;
	}
	const isPinned = normalizedCurrent.includes(normalizedSessionId);
	const shouldPin = nextPinned ?? !isPinned;
	const next = shouldPin
		? normalizePinnedRunningAvatarIds([...normalizedCurrent, normalizedSessionId])
		: normalizePinnedRunningAvatarIds(
				normalizedCurrent.filter((currentId) => currentId !== normalizedSessionId),
			);

	if (sameIds(currentIds, next)) {
		return currentIds;
	}
	if (sameIds(normalizedCurrent, next)) {
		return next;
	}
	return next;
};

export const reconcilePinnedRunningAvatarIds = (
	currentIds: string[],
	availableIds: readonly string[],
): string[] => {
	const available = new Set(normalizePinnedRunningAvatarIds(availableIds));
	const normalizedCurrent = normalizePinnedRunningAvatarIds(currentIds);
	const next = normalizePinnedRunningAvatarIds(
		normalizedCurrent.filter((id) => available.has(id)),
	);

	if (sameIds(currentIds, next)) {
		return currentIds;
	}
	if (sameIds(normalizedCurrent, next)) {
		return next;
	}
	return next;
};
