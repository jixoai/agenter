import type {
	AuthDraftCreateOutput,
	AuthDraftDeleteOutput,
	AuthDraftEntry,
	AuthDraftSaveOutput,
	AvatarCreateDraftState,
} from '@agenter/client-sdk';

export const AVATAR_CREATE_DRAFT_KIND = 'avatar_create';

const normalizeField = (value: string | null | undefined, maxLength: number): string => {
	const trimmed = value?.trim() ?? '';
	return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
};

export const normalizeAvatarCreateDraftState = (
	state: Partial<AvatarCreateDraftState> | AvatarCreateDraftState,
): AvatarCreateDraftState => ({
	nickname: normalizeField(state.nickname, 64),
	sourceAvatarNickname: normalizeField(state.sourceAvatarNickname, 64),
});

export interface AvatarCreateDraftResource {
	draftId: string;
	version: number;
	createdAt: number;
	updatedAt: number;
	state: AvatarCreateDraftState;
}

export interface AvatarCreateDraftStoreClient {
	createAuthDraft(input: {
		kind: 'avatar_create';
		state: AvatarCreateDraftState;
	}): Promise<AuthDraftCreateOutput>;
	getAuthDraft(draftId: string): Promise<AuthDraftEntry | null>;
	saveAuthDraft(input: {
		draftId: string;
		kind: 'avatar_create';
		state: AvatarCreateDraftState;
		baseVersion?: number;
	}): Promise<AuthDraftSaveOutput>;
	deleteAuthDraft(input: {
		draftId: string;
		baseVersion?: number;
	}): Promise<AuthDraftDeleteOutput>;
}

const isAvatarCreateDraftEntry = (
	entry: AuthDraftEntry | null,
): entry is AuthDraftEntry<'avatar_create'> => entry?.kind === AVATAR_CREATE_DRAFT_KIND;

const toAvatarCreateDraftResource = (
	entry: AuthDraftEntry<'avatar_create'>,
): AvatarCreateDraftResource => ({
	draftId: entry.draftId,
	version: entry.version,
	createdAt: entry.createdAt,
	updatedAt: entry.updatedAt,
	state: normalizeAvatarCreateDraftState(entry.state),
});

export const createAvatarCreateDraft = async (
	runtimeStore: AvatarCreateDraftStoreClient,
	input: Partial<AvatarCreateDraftState> = {},
): Promise<AuthDraftCreateOutput & { resource: AvatarCreateDraftResource }> => {
	const created = await runtimeStore.createAuthDraft({
		kind: AVATAR_CREATE_DRAFT_KIND,
		state: normalizeAvatarCreateDraftState(input),
	});
	return {
		...created,
		resource: toAvatarCreateDraftResource(created.entry),
	};
};

export const getAvatarCreateDraft = async (
	runtimeStore: AvatarCreateDraftStoreClient,
	draftId: string,
): Promise<AvatarCreateDraftResource | null> => {
	const entry = await runtimeStore.getAuthDraft(draftId);
	return isAvatarCreateDraftEntry(entry) ? toAvatarCreateDraftResource(entry) : null;
};

export const saveAvatarCreateDraft = async (
	runtimeStore: AvatarCreateDraftStoreClient,
	input: {
		draftId: string;
		state: AvatarCreateDraftState;
		baseVersion?: number;
	},
): Promise<
	AuthDraftSaveOutput & {
		resource?: AvatarCreateDraftResource;
	}
> => {
	const result = await runtimeStore.saveAuthDraft({
		draftId: input.draftId,
		kind: AVATAR_CREATE_DRAFT_KIND,
		state: normalizeAvatarCreateDraftState(input.state),
		baseVersion: input.baseVersion,
	});
	if (!result.ok) {
		return {
			...result,
			resource: isAvatarCreateDraftEntry(result.latest) ? toAvatarCreateDraftResource(result.latest) : undefined,
		};
	}
	return {
		...result,
		resource: toAvatarCreateDraftResource(result.entry),
	};
};

export const deleteAvatarCreateDraft = async (
	runtimeStore: AvatarCreateDraftStoreClient,
	input: {
		draftId: string;
		baseVersion?: number;
	},
): Promise<
	AuthDraftDeleteOutput & {
		resource?: AvatarCreateDraftResource;
	}
> => {
	const result = await runtimeStore.deleteAuthDraft(input);
	if (!result.ok) {
		return {
			...result,
			resource: isAvatarCreateDraftEntry(result.latest) ? toAvatarCreateDraftResource(result.latest) : undefined,
		};
	}
	return result;
};
