export type JsonViewerMode = 'raw-text-json' | 'fmt-highlight-json' | 'highlight-yaml';

export const JSON_VIEWER_GLOBAL_MODE_STORAGE_KEY = 'agenter:web-components:json-viewer-mode';
export const DEFAULT_JSON_VIEWER_MODE: JsonViewerMode = 'highlight-yaml';
export const JSON_VIEWER_MODE_OPTIONS = [
	{
		mode: 'highlight-yaml',
		label: 'YAML preview',
		description: 'Compact readable preview',
	},
	{
		mode: 'fmt-highlight-json',
		label: 'Formatted JSON',
		description: 'Pretty JSON with highlighting',
	},
	{
		mode: 'raw-text-json',
		label: 'Plain text',
		description: 'Exact payload text',
	},
] as const satisfies ReadonlyArray<{
	mode: JsonViewerMode;
	label: string;
	description: string;
}>;

let cachedGlobalMode: JsonViewerMode = DEFAULT_JSON_VIEWER_MODE;
let globalModeInitialized = false;
const globalModeListeners = new Set<() => void>();
let storageListenerBound = false;

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const normalizeJsonViewerMode = (value: unknown): JsonViewerMode => {
	return value === 'raw-text-json' || value === 'fmt-highlight-json' || value === 'highlight-yaml'
		? value
		: DEFAULT_JSON_VIEWER_MODE;
};

const readPersistedGlobalMode = (): JsonViewerMode => {
	if (!isBrowser()) {
		return DEFAULT_JSON_VIEWER_MODE;
	}
	try {
		return normalizeJsonViewerMode(window.localStorage.getItem(JSON_VIEWER_GLOBAL_MODE_STORAGE_KEY));
	} catch {
		return DEFAULT_JSON_VIEWER_MODE;
	}
};

const notifyGlobalModeListeners = (): void => {
	for (const listener of globalModeListeners) {
		listener();
	}
};

const ensureStorageListener = (): void => {
	if (storageListenerBound || !isBrowser()) {
		return;
	}
	window.addEventListener('storage', (event) => {
		if (event.key !== JSON_VIEWER_GLOBAL_MODE_STORAGE_KEY) {
			return;
		}
		cachedGlobalMode = normalizeJsonViewerMode(event.newValue);
		globalModeInitialized = true;
		notifyGlobalModeListeners();
	});
	storageListenerBound = true;
};

export const getGlobalJsonViewerModeSnapshot = (): JsonViewerMode => {
	if (!globalModeInitialized) {
		cachedGlobalMode = readPersistedGlobalMode();
		globalModeInitialized = true;
	}
	ensureStorageListener();
	return cachedGlobalMode;
};

export const subscribeGlobalJsonViewerMode = (listener: () => void): (() => void) => {
	ensureStorageListener();
	globalModeListeners.add(listener);
	return () => {
		globalModeListeners.delete(listener);
	};
};

export const setGlobalJsonViewerMode = (mode: JsonViewerMode): void => {
	const next = normalizeJsonViewerMode(mode);
	if (getGlobalJsonViewerModeSnapshot() === next) {
		return;
	}
	cachedGlobalMode = next;
	globalModeInitialized = true;
	if (isBrowser()) {
		try {
			window.localStorage.setItem(JSON_VIEWER_GLOBAL_MODE_STORAGE_KEY, next);
		} catch {
			// Ignore storage failures; the in-memory mode still updates mounted viewers.
		}
	}
	notifyGlobalModeListeners();
};

export const resolveJsonViewerMode = (input: {
	localMode?: JsonViewerMode | null;
	globalMode?: JsonViewerMode | null;
}): JsonViewerMode => {
	if (input.localMode) {
		return normalizeJsonViewerMode(input.localMode);
	}
	if (input.globalMode) {
		return normalizeJsonViewerMode(input.globalMode);
	}
	return DEFAULT_JSON_VIEWER_MODE;
};

export const getJsonViewerModeLabel = (mode: JsonViewerMode): string => {
	return JSON_VIEWER_MODE_OPTIONS.find((option) => option.mode === mode)?.label ?? mode;
};
