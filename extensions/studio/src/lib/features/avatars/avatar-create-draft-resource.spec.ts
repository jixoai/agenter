import { describe, expect, test } from 'vitest';

import type { AuthDraftEntry } from '@agenter/client-sdk';

import {
	createAvatarCreateDraft,
	deleteAvatarCreateDraft,
	getAvatarCreateDraft,
	saveAvatarCreateDraft,
	type AvatarCreateDraftStoreClient,
} from './avatar-create-draft-resource';

const createDraftStoreStub = (): AvatarCreateDraftStoreClient => {
	let entry: AuthDraftEntry<'avatar_create'> | null = null;

	return {
		async createAuthDraft(input) {
			entry = {
				draftId: '11111111-1111-4111-8111-111111111111',
				kind: 'avatar_create',
				state: input.state,
				version: 1,
				createdAt: 1,
				updatedAt: 1,
			};
			return {
				eventId: 1,
				entry,
			};
		},
		async getAuthDraft() {
			return entry;
		},
		async saveAuthDraft(input) {
			if (!entry) {
				return {
					ok: false,
					reason: 'not_found',
					latest: null,
				};
			}
			entry = {
				...entry,
				state: input.state,
				version: entry.version + 1,
				updatedAt: entry.updatedAt + 1,
			};
			return {
				ok: true,
				changed: true,
				eventId: entry.version,
				entry,
			};
		},
		async deleteAuthDraft(input) {
			const existing = entry;
			entry = null;
			return {
				ok: true,
				removed: existing !== null,
				eventId: existing ? existing.version + 1 : null,
				draftId: input.draftId,
				kind: existing?.kind ?? null,
				version: existing ? existing.version + 1 : null,
			};
		},
	};
};

describe('Feature: Avatar create draft resource helper', () => {
	test('Scenario: Given a durable avatar draft When create save resume and delete are used Then the resource keeps stable identity until completion removes it', async () => {
		const store = createDraftStoreStub();

		const created = await createAvatarCreateDraft(store, {
			nickname: '  reviewer  ',
			sourceAvatarNickname: ' default ',
		});
		expect(created.resource).toEqual({
			draftId: '11111111-1111-4111-8111-111111111111',
			version: 1,
			createdAt: 1,
			updatedAt: 1,
			state: {
				nickname: 'reviewer',
				sourceAvatarNickname: 'default',
			},
		});

		const saved = await saveAvatarCreateDraft(store, {
			draftId: created.resource.draftId,
			baseVersion: created.resource.version,
			state: {
				nickname: 'reviewer-2',
				sourceAvatarNickname: 'default',
			},
		});
		expect(saved.ok).toBe(true);
		expect(saved.resource?.version).toBe(2);

		const resumed = await getAvatarCreateDraft(store, created.resource.draftId);
		expect(resumed).toEqual({
			draftId: '11111111-1111-4111-8111-111111111111',
			version: 2,
			createdAt: 1,
			updatedAt: 2,
			state: {
				nickname: 'reviewer-2',
				sourceAvatarNickname: 'default',
			},
		});

		const removed = await deleteAvatarCreateDraft(store, {
			draftId: created.resource.draftId,
			baseVersion: 2,
		});
		expect(removed).toEqual({
			ok: true,
			removed: true,
			eventId: 3,
			draftId: '11111111-1111-4111-8111-111111111111',
			kind: 'avatar_create',
			version: 3,
		});
		expect(await getAvatarCreateDraft(store, created.resource.draftId)).toBeNull();
	});

	test('Scenario: Given draft deletion conflicts When deleting the durable draft Then the helper returns the latest avatar-create resource for UI recovery', async () => {
		const store: AvatarCreateDraftStoreClient = {
			async createAuthDraft() {
				throw new Error('not used');
			},
			async getAuthDraft() {
				return null;
			},
			async saveAuthDraft() {
				throw new Error('not used');
			},
			async deleteAuthDraft() {
				return {
					ok: false,
					reason: 'conflict',
					latest: {
						draftId: '11111111-1111-4111-8111-111111111111',
						kind: 'avatar_create',
						state: {
							nickname: 'reviewer-2',
							sourceAvatarNickname: 'default',
						},
						version: 4,
						createdAt: 1,
						updatedAt: 5,
					},
				};
			},
		};

		const removed = await deleteAvatarCreateDraft(store, {
			draftId: '11111111-1111-4111-8111-111111111111',
			baseVersion: 3,
		});

		expect(removed).toEqual({
			ok: false,
			reason: 'conflict',
			latest: {
				draftId: '11111111-1111-4111-8111-111111111111',
				kind: 'avatar_create',
				state: {
					nickname: 'reviewer-2',
					sourceAvatarNickname: 'default',
				},
				version: 4,
				createdAt: 1,
				updatedAt: 5,
			},
			resource: {
				draftId: '11111111-1111-4111-8111-111111111111',
				version: 4,
				createdAt: 1,
				updatedAt: 5,
				state: {
					nickname: 'reviewer-2',
					sourceAvatarNickname: 'default',
				},
			},
		});
	});
});
