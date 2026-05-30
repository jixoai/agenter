export type SkillsCatalogView = 'shared' | 'built-in' | 'global' | 'avatars';

export const SKILLS_CATALOG_VIEW_QUERY_PARAM = 'view';
export const SKILLS_AVATAR_QUERY_PARAM = 'avatar';

const normalizeNonEmpty = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
};

/**
 * The catalog query param uses one canonical page-tab key. Legacy `avatar`
 * links are normalized to `avatars` so the route can converge without keeping
 * two durable spellings alive.
 */
export const normalizeSkillsCatalogView = (value: string | null | undefined): SkillsCatalogView => {
	if (value === 'built-in' || value === 'shared' || value === 'global' || value === 'avatars') {
		return value;
	}
	if (value === 'avatar') {
		return 'avatars';
	}
	return 'shared';
};

export const readSkillsCatalogView = (searchParams: URLSearchParams): SkillsCatalogView =>
	normalizeSkillsCatalogView(searchParams.get(SKILLS_CATALOG_VIEW_QUERY_PARAM));

export const readSkillsAvatarNickname = (searchParams: URLSearchParams): string | null =>
	normalizeNonEmpty(searchParams.get(SKILLS_AVATAR_QUERY_PARAM));

export const buildSkillsCatalogHref = (
	input: {
		view?: SkillsCatalogView | null;
		avatar?: string | null;
	} = {},
): string => {
	const view = normalizeSkillsCatalogView(input.view);
	const avatar = normalizeNonEmpty(input.avatar);
	const params = new URLSearchParams();
	if (view !== 'shared') {
		params.set(SKILLS_CATALOG_VIEW_QUERY_PARAM, view);
	}
	if (view === 'avatars' && avatar) {
		params.set(SKILLS_AVATAR_QUERY_PARAM, avatar);
	}
	const search = params.toString();
	return search.length > 0 ? `/skills?${search}` : '/skills';
};

export const buildSkillAvatarHref = (avatarNickname: string): string =>
	`/skills/avatar/${encodeURIComponent(normalizeNonEmpty(avatarNickname) ?? '')}`;
