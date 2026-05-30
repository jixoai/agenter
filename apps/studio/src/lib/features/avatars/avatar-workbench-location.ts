export const AVATAR_CATALOG_QUERY_PARAM = 'avatar';
export const AVATAR_NEW_SOURCE_QUERY_PARAM = 'source';

const normalizeNonEmpty = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
};

export const buildAvatarCatalogHref = (input: { avatar?: string | null } = {}): string => {
	const params = new URLSearchParams();
	const avatar = normalizeNonEmpty(input.avatar);
	if (avatar) {
		params.set(AVATAR_CATALOG_QUERY_PARAM, avatar);
	}
	const search = params.toString();
	return search.length > 0 ? `/avatars/catalog?${search}` : '/avatars/catalog';
};

export const buildAvatarNewHref = (input: { draftId: string; sourceAvatarNickname?: string | null }): string => {
	const pathname = `/avatars/new/${encodeURIComponent(input.draftId)}`;
	const params = new URLSearchParams();
	const sourceAvatarNickname = normalizeNonEmpty(input.sourceAvatarNickname);
	if (sourceAvatarNickname) {
		params.set(AVATAR_NEW_SOURCE_QUERY_PARAM, sourceAvatarNickname);
	}
	const search = params.toString();
	return search.length > 0 ? `${pathname}?${search}` : pathname;
};

export const readAvatarNewSourceNickname = (searchParams: URLSearchParams): string | null =>
	normalizeNonEmpty(searchParams.get(AVATAR_NEW_SOURCE_QUERY_PARAM));

export const createAvatarDraftId = (): string => {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
