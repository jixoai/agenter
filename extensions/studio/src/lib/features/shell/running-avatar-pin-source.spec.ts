import { describe, expect, test } from 'vitest';

import type { AuthKvEntry } from '@agenter/client-sdk';

import { RunningAvatarPinSource, type RunningAvatarPinStoreClient } from './running-avatar-pin-source';

const PIN_KEY = 'studio/avatars/pinned-runtime-ids';

const createStoreStub = (initialIds: string[] = []): RunningAvatarPinStoreClient => {
	let entry: AuthKvEntry | null =
		initialIds.length > 0
			? {
					key: PIN_KEY,
					value: {
						ids: initialIds,
					},
					version: 1,
					updatedAt: 1,
			  }
			: null;
	let lastEventId = entry ? 1 : 0;
	let eventListener:
		| ((event: {
				eventId: number;
				timestamp: number;
				kind: 'set' | 'delete';
				entry?: AuthKvEntry;
				key?: string;
				version?: number;
		  }) => void)
		| null = null;

	const notify = (): void => {
		if (!eventListener) {
			return;
		}
		if (entry) {
			eventListener({
				eventId: lastEventId,
				timestamp: entry.updatedAt,
				kind: 'set',
				entry,
			});
			return;
		}
		eventListener({
			eventId: lastEventId,
			timestamp: lastEventId,
			kind: 'delete',
			key: PIN_KEY,
			version: lastEventId,
		});
	};

	return {
		async snapshotAuthKv() {
			return {
				lastEventId,
				items: entry ? [entry] : [],
			};
		},
		async setAuthKv(input) {
			if (entry && input.baseVersion !== null && input.baseVersion !== undefined && input.baseVersion !== entry.version) {
				return {
					ok: false,
					reason: 'conflict',
					latest: entry,
				};
			}
			lastEventId += 1;
			entry = {
				key: input.key,
				value: input.value,
				version: entry ? entry.version + 1 : 1,
				updatedAt: lastEventId,
			};
			notify();
			return {
				ok: true,
				changed: true,
				eventId: lastEventId,
				entry,
			};
		},
		async deleteAuthKv(input) {
			if (!entry) {
				return {
					ok: true,
					removed: false,
					eventId: null,
					key: input.key,
					version: null,
				};
			}
			if (input.baseVersion !== undefined && input.baseVersion !== entry.version) {
				return {
					ok: false,
					reason: 'conflict',
					latest: entry,
				};
			}
			lastEventId += 1;
			const removedVersion = entry.version + 1;
			entry = null;
			notify();
			return {
				ok: true,
				removed: true,
				eventId: lastEventId,
				key: PIN_KEY,
				version: removedVersion,
			};
		},
		subscribeAuthKvEvents(_input, handlers) {
			eventListener = (event) => {
				if (event.kind === 'set' && event.entry) {
					handlers.onData({
						eventId: event.eventId,
						timestamp: event.timestamp,
						kind: 'set',
						entry: event.entry,
					});
					return;
				}
				handlers.onData({
					eventId: event.eventId,
					timestamp: event.timestamp,
					kind: 'delete',
					key: event.key ?? PIN_KEY,
					version: event.version ?? 0,
				});
			};
			return {
				unsubscribe: () => {
					eventListener = null;
				},
			};
		},
	} satisfies RunningAvatarPinStoreClient;
};

describe('Feature: Running avatar pin source', () => {
	test('Scenario: Given actor-private server pins When hydrating Then the shell reads the synced ids instead of browser-local storage', async () => {
		const source = new RunningAvatarPinSource();
		const store = createStoreStub(['session-alpha', 'session-beta']);

		const snapshot = await source.hydrate(store);

		expect(snapshot).toEqual({
			ids: ['session-alpha', 'session-beta'],
			version: 1,
			lastEventId: 1,
		});
	});

	test('Scenario: Given another client is listening When the source toggles a pin Then the subscriber receives the synced pin projection', async () => {
		const source = new RunningAvatarPinSource();
		const store = createStoreStub(['session-alpha']);
		const seen: string[][] = [];

		await source.hydrate(store);
		const unsubscribe = source.subscribe(store, (snapshot) => {
			seen.push(snapshot.ids);
		});

		const snapshot = await source.toggle(store, 'session-beta', true);

		expect(snapshot.ids).toEqual(['session-alpha', 'session-beta']);
		expect(seen.at(-1)).toEqual(['session-alpha', 'session-beta']);
		unsubscribe();
	});
});
