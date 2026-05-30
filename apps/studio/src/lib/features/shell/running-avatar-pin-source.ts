import type { AuthKvDeleteOutput, AuthKvEntry, AuthKvEvent, AuthKvSetOutput, AuthKvSnapshotOutput } from '@agenter/client-sdk';

import {
	normalizePinnedRunningAvatarIds,
	reconcilePinnedRunningAvatarIds,
	togglePinnedRunningAvatarId,
} from './running-avatar-rail-state';

const RUNNING_AVATAR_PINS_KEY = 'studio/avatars/pinned-runtime-ids';

export interface RunningAvatarPinSnapshot {
	ids: string[];
	version: number | null;
	lastEventId: number;
}

export interface RunningAvatarPinStoreClient {
	snapshotAuthKv(input: { keys?: string[]; prefix?: string }): Promise<AuthKvSnapshotOutput>;
	setAuthKv(input: {
		key: string;
		value: AuthKvEntry['value'];
		baseVersion?: number | null;
	}): Promise<AuthKvSetOutput>;
	deleteAuthKv(input: {
		key: string;
		baseVersion?: number | null;
	}): Promise<AuthKvDeleteOutput>;
	subscribeAuthKvEvents(
		input:
			| {
					afterEventId?: number;
					keys?: string[];
					prefix?: string;
			  }
			| undefined,
		handlers: {
			onData: (event: AuthKvEvent) => void;
			onError?: (error: unknown) => void;
		},
	): { unsubscribe: () => void };
}

const parsePinnedIds = (value: AuthKvEntry['value'] | undefined): string[] => {
	if (!value || typeof value !== 'object' || Array.isArray(value) || !('ids' in value)) {
		return [];
	}
	const ids = value.ids;
	return Array.isArray(ids)
		? normalizePinnedRunningAvatarIds(ids.filter((item): item is string => typeof item === 'string'))
		: [];
};

const toSnapshot = (
	entry: AuthKvEntry | null | undefined,
	lastEventId: number,
): RunningAvatarPinSnapshot => ({
	ids: parsePinnedIds(entry?.value),
	version: entry?.version ?? null,
	lastEventId,
});

export class RunningAvatarPinSource {
	#snapshot: RunningAvatarPinSnapshot = {
		ids: [],
		version: null,
		lastEventId: 0,
	};

	get snapshot(): RunningAvatarPinSnapshot {
		return this.#snapshot;
	}

	async hydrate(runtimeStore: RunningAvatarPinStoreClient): Promise<RunningAvatarPinSnapshot> {
		try {
			const snapshot = await runtimeStore.snapshotAuthKv({
				keys: [RUNNING_AVATAR_PINS_KEY],
			});
			const entry = snapshot.items[0] ?? null;
			this.#snapshot = toSnapshot(entry, snapshot.lastEventId);
		} catch {
			this.#snapshot = {
				ids: [],
				version: null,
				lastEventId: 0,
			};
		}
		return this.#snapshot;
	}

	subscribe(
		runtimeStore: RunningAvatarPinStoreClient,
		listener: (snapshot: RunningAvatarPinSnapshot) => void,
	): () => void {
		const sub = runtimeStore.subscribeAuthKvEvents(
			{
				afterEventId: this.#snapshot.lastEventId,
				keys: [RUNNING_AVATAR_PINS_KEY],
			},
			{
				onData: (event) => {
					if (event.kind === 'set') {
						this.#snapshot = toSnapshot(event.entry, event.eventId);
					} else {
						this.#snapshot = {
							ids: [],
							version: null,
							lastEventId: event.eventId,
						};
					}
					listener(this.#snapshot);
				},
			},
		);
		return () => {
			sub.unsubscribe();
		};
	}

	async toggle(
		runtimeStore: RunningAvatarPinStoreClient,
		sessionId: string,
		nextPinned?: boolean,
	): Promise<RunningAvatarPinSnapshot> {
		return await this.#commit(
			runtimeStore,
			(currentIds) => togglePinnedRunningAvatarId(currentIds, sessionId, nextPinned),
		);
	}

	async reconcile(
		runtimeStore: RunningAvatarPinStoreClient,
		availableIds: readonly string[],
	): Promise<RunningAvatarPinSnapshot> {
		return await this.#commit(
			runtimeStore,
			(currentIds) => reconcilePinnedRunningAvatarIds(currentIds, availableIds),
		);
	}

	async #commit(
		runtimeStore: RunningAvatarPinStoreClient,
		resolveNextIds: (currentIds: string[]) => string[],
	): Promise<RunningAvatarPinSnapshot> {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const currentIds = this.#snapshot.ids;
			const nextIds = normalizePinnedRunningAvatarIds(resolveNextIds(currentIds));
			if (nextIds.length === 0) {
				const result = await runtimeStore.deleteAuthKv({
					key: RUNNING_AVATAR_PINS_KEY,
					baseVersion: this.#snapshot.version ?? undefined,
				});
				if (result.ok) {
					this.#snapshot = {
						ids: [],
						version: null,
						lastEventId: result.eventId ?? this.#snapshot.lastEventId,
					};
					return this.#snapshot;
				}
				this.#snapshot = toSnapshot(result.latest, this.#snapshot.lastEventId);
				continue;
			}

			const result = await runtimeStore.setAuthKv({
				key: RUNNING_AVATAR_PINS_KEY,
				value: {
					ids: nextIds,
				},
				baseVersion: this.#snapshot.version ?? null,
			});
			if (result.ok) {
				this.#snapshot = toSnapshot(result.entry, result.eventId ?? this.#snapshot.lastEventId);
				return this.#snapshot;
			}
			this.#snapshot = toSnapshot(result.latest, this.#snapshot.lastEventId);
		}
		return this.#snapshot;
	}
}
