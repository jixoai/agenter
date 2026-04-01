const AUTH_SESSION_STORAGE_KEY = 'agenter:webui:auth-session';

interface StoredAuthSessionRecord {
	token?: unknown;
}

export const readStoredAuthToken = (): string => {
	if (typeof window === 'undefined') {
		return '';
	}
	try {
		const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
		if (!raw) {
			return '';
		}
		const parsed = JSON.parse(raw) as StoredAuthSessionRecord;
		return typeof parsed.token === 'string' ? parsed.token : '';
	} catch {
		return '';
	}
};

export const writeStoredAuthToken = (token: string | null | undefined): void => {
	if (typeof window === 'undefined') {
		return;
	}
	const normalized = token?.trim() ?? '';
	if (normalized.length === 0) {
		window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
		return;
	}
	window.localStorage.setItem(
		AUTH_SESSION_STORAGE_KEY,
		JSON.stringify({
			token: normalized,
		}),
	);
};
