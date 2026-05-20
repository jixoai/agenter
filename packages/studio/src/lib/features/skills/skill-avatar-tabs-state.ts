import { buildSkillAvatarHref } from './skills-workbench-location';

const SKILL_AVATAR_TABS_STORAGE_KEY = 'agenter:studio:skills:avatar-tabs';
export const SKILL_AVATAR_TABS_CHANGE_EVENT = 'agenter:skills-avatar-tabs-change';

export interface SkillAvatarTabEntry {
	id: string;
	avatarNickname: string;
	href: string;
}

const normalizeAvatarNickname = (value: string): string => value.trim();

export const createSkillAvatarTabId = (avatarNickname: string): string =>
	`skill-avatar:${normalizeAvatarNickname(avatarNickname)}`;

export const createSkillAvatarTabEntry = (input: {
	avatarNickname: string;
}): SkillAvatarTabEntry => {
	const normalizedAvatarNickname = normalizeAvatarNickname(input.avatarNickname);
	return {
		id: createSkillAvatarTabId(normalizedAvatarNickname),
		avatarNickname: normalizedAvatarNickname,
		href: buildSkillAvatarHref(normalizedAvatarNickname),
	};
};

const normalizeSkillAvatarTabs = (entries: readonly SkillAvatarTabEntry[]): SkillAvatarTabEntry[] => {
	const normalized: SkillAvatarTabEntry[] = [];
	const seenIds = new Set<string>();

	for (const entry of entries) {
		const avatarNickname = normalizeAvatarNickname(entry.avatarNickname);
		if (avatarNickname.length === 0) {
			continue;
		}
		const normalizedEntry = createSkillAvatarTabEntry({
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

const sameTabIds = (left: readonly SkillAvatarTabEntry[], right: readonly SkillAvatarTabEntry[]): boolean =>
	left.length === right.length && left.every((entry, index) => entry.id === right[index]?.id);

const emitSkillAvatarTabsChange = (): void => {
	if (typeof window === 'undefined') {
		return;
	}
	window.dispatchEvent(new CustomEvent(SKILL_AVATAR_TABS_CHANGE_EVENT));
};

export const readSkillAvatarTabs = (): SkillAvatarTabEntry[] => {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(SKILL_AVATAR_TABS_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as {
			entries?: Array<{ avatarNickname?: unknown }>;
		};
		if (!Array.isArray(parsed.entries)) {
			return [];
		}
		return normalizeSkillAvatarTabs(
			parsed.entries
				.filter((entry): entry is { avatarNickname: string } => typeof entry?.avatarNickname === 'string')
				.map((entry) =>
					createSkillAvatarTabEntry({
						avatarNickname: entry.avatarNickname,
					}),
				),
		);
	} catch {
		return [];
	}
};

export const writeSkillAvatarTabs = (entries: readonly SkillAvatarTabEntry[]): void => {
	if (typeof window === 'undefined') {
		return;
	}
	const normalized = normalizeSkillAvatarTabs(entries);
	if (normalized.length === 0) {
		window.localStorage.removeItem(SKILL_AVATAR_TABS_STORAGE_KEY);
		emitSkillAvatarTabsChange();
		return;
	}
	window.localStorage.setItem(
		SKILL_AVATAR_TABS_STORAGE_KEY,
		JSON.stringify({
			entries: normalized.map((entry) => ({
				avatarNickname: entry.avatarNickname,
			})),
		}),
	);
	emitSkillAvatarTabsChange();
};

export const upsertSkillAvatarTab = (
	currentEntries: SkillAvatarTabEntry[],
	input: {
		avatarNickname: string;
	},
): { entries: SkillAvatarTabEntry[]; entry: SkillAvatarTabEntry } => {
	const normalizedCurrent = normalizeSkillAvatarTabs(currentEntries);
	const entry = createSkillAvatarTabEntry(input);
	const existing = normalizedCurrent.find((currentEntry) => currentEntry.id === entry.id);
	if (existing) {
		if (sameTabIds(currentEntries, normalizedCurrent)) {
			return { entries: currentEntries, entry: existing };
		}
		writeSkillAvatarTabs(normalizedCurrent);
		return { entries: normalizedCurrent, entry: existing };
	}
	const next = [...normalizedCurrent, entry];
	writeSkillAvatarTabs(next);
	return { entries: next, entry };
};

export const removeSkillAvatarTab = (
	currentEntries: SkillAvatarTabEntry[],
	tabId: string,
): SkillAvatarTabEntry[] => {
	const normalizedCurrent = normalizeSkillAvatarTabs(currentEntries);
	const next = normalizedCurrent.filter((entry) => entry.id !== tabId);
	if (sameTabIds(currentEntries, next)) {
		return currentEntries;
	}
	if (sameTabIds(normalizedCurrent, next)) {
		return next;
	}
	writeSkillAvatarTabs(next);
	return next;
};
