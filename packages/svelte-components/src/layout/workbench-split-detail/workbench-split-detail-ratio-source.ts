import { get, set } from "idb-keyval";

import { clampWorkbenchSplitDetailRatio } from "./workbench-split-detail-math.js";

export interface WorkbenchSplitDetailRatioSource {
	read: () => number | null | Promise<number | null>;
	write: (ratio: number) => void | Promise<void>;
	subscribe?: (listener: (ratio: number) => void) => (() => void) | void;
}

export type WorkbenchSplitDetailRatioPersistence =
	| string
	| WorkbenchSplitDetailRatioSource
	| null
	| undefined;

interface WorkbenchSplitDetailRatioBroadcastPayload {
	key: string;
	ratio: number;
}

const RATIO_SOURCE_NAMESPACE = "agenter:svelte-components:workbench-split-detail:ratio:v1";
const RATIO_BROADCAST_CHANNEL = `${RATIO_SOURCE_NAMESPACE}:broadcast`;
const persistedRatioCache = new Map<string, number>();
const defaultRatioSourceCache = new Map<string, WorkbenchSplitDetailRatioSource>();

const isFiniteNumber = (value: unknown): value is number => {
	return typeof value === "number" && Number.isFinite(value);
};

const normalizeRatio = (value: unknown): number | null => {
	if (!isFiniteNumber(value)) {
		return null;
	}
	return clampWorkbenchSplitDetailRatio(value);
};

class DefaultWorkbenchSplitDetailRatioSource implements WorkbenchSplitDetailRatioSource {
	readonly #storageKey: string;
	readonly #listeners = new Set<(ratio: number) => void>();
	#channel: BroadcastChannel | null = null;

	constructor(key: string) {
		this.#storageKey = `${RATIO_SOURCE_NAMESPACE}:${key}`;
	}

	async read(): Promise<number | null> {
		const cached = persistedRatioCache.get(this.#storageKey);
		if (cached !== undefined) {
			return cached;
		}
		try {
			const value = normalizeRatio(await get<number>(this.#storageKey));
			if (value === null) {
				return null;
			}
			persistedRatioCache.set(this.#storageKey, value);
			return value;
		} catch {
			return null;
		}
	}

	async write(ratio: number): Promise<void> {
		const nextRatio = normalizeRatio(ratio);
		if (nextRatio === null) {
			return;
		}
		persistedRatioCache.set(this.#storageKey, nextRatio);
		this.#emit(nextRatio);
		try {
			await set(this.#storageKey, nextRatio);
		} catch {
			// Ignore persistence failures and keep the in-memory cache coherent.
		}
		this.#ensureChannel()?.postMessage({
			key: this.#storageKey,
			ratio: nextRatio,
		} satisfies WorkbenchSplitDetailRatioBroadcastPayload);
	}

	subscribe(listener: (ratio: number) => void): () => void {
		this.#listeners.add(listener);
		this.#ensureChannel();
		return () => {
			this.#listeners.delete(listener);
		};
	}

	#emit(ratio: number): void {
		for (const listener of this.#listeners) {
			listener(ratio);
		}
	}

	#ensureChannel(): BroadcastChannel | null {
		if (this.#channel) {
			return this.#channel;
		}
		if (typeof globalThis.BroadcastChannel !== "function") {
			return null;
		}
		try {
			this.#channel = new globalThis.BroadcastChannel(RATIO_BROADCAST_CHANNEL);
			this.#channel.onmessage = (event: MessageEvent<WorkbenchSplitDetailRatioBroadcastPayload>) => {
				const payload = event.data;
				if (!payload || payload.key !== this.#storageKey) {
					return;
				}
				const nextRatio = normalizeRatio(payload.ratio);
				if (nextRatio === null || persistedRatioCache.get(this.#storageKey) === nextRatio) {
					return;
				}
				persistedRatioCache.set(this.#storageKey, nextRatio);
				this.#emit(nextRatio);
			};
		} catch {
			this.#channel = null;
		}
		return this.#channel;
	}
}

export const getDefaultWorkbenchSplitDetailRatioSource = (
	key: string,
): WorkbenchSplitDetailRatioSource => {
	const nextKey = key.trim();
	const cached = defaultRatioSourceCache.get(nextKey);
	if (cached) {
		return cached;
	}
	const source = new DefaultWorkbenchSplitDetailRatioSource(nextKey);
	defaultRatioSourceCache.set(nextKey, source);
	return source;
};

export const resolveWorkbenchSplitDetailRatioSource = (
	persistence: WorkbenchSplitDetailRatioPersistence,
): WorkbenchSplitDetailRatioSource | null => {
	if (typeof persistence === "string") {
		const nextKey = persistence.trim();
		return nextKey.length > 0 ? getDefaultWorkbenchSplitDetailRatioSource(nextKey) : null;
	}
	return persistence ?? null;
};
