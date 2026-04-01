import { env } from '$env/dynamic/public';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/u, '');

const normalizeWsEndpoint = (value: string): string => {
	const trimmed = trimTrailingSlash(value.trim());
	if (trimmed.endsWith('/trpc')) {
		return trimmed;
	}
	return `${trimmed}/trpc`;
};

export const resolveAgenterWsUrl = (input?: {
	locationHref?: string;
	publicWsUrl?: string | null | undefined;
}): string => {
	const configured =
		input?.publicWsUrl?.trim() ??
		env.PUBLIC_AGENTER_WS_URL?.trim() ??
		'';
	if (configured.length > 0) {
		return normalizeWsEndpoint(configured);
	}

	const href =
		input?.locationHref ??
		(typeof window === 'undefined' ? 'http://127.0.0.1:4580/' : window.location.href);
	const url = new URL(href);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	url.pathname = '/trpc';
	url.search = '';
	url.hash = '';
	return trimTrailingSlash(url.toString());
};
