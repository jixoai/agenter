const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const decodePointerToken = (token: string): string => token.replaceAll('~1', '/').replaceAll('~0', '~');

const encodePointerToken = (token: string): string => token.replaceAll('~', '~0').replaceAll('/', '~1');

const asArrayIndex = (token: string): number | null => {
	if (!/^(0|[1-9]\d*)$/u.test(token)) {
		return null;
	}
	const parsed = Number(token);
	return Number.isSafeInteger(parsed) ? parsed : null;
};

export const pointerToTokens = (pointer: string): string[] => {
	if (pointer.length === 0) {
		return [];
	}
	return pointer
		.split('/')
		.slice(1)
		.map((token) => decodePointerToken(token));
};

export const tokensToPointer = (tokens: string[]): string =>
	tokens.length === 0 ? '' : `/${tokens.map((token) => encodePointerToken(token)).join('/')}`;

export const getValueAtPointer = (root: unknown, pointer: string): unknown => {
	if (pointer.length === 0) {
		return root;
	}
	const tokens = pointerToTokens(pointer);
	let cursor: unknown = root;
	for (const token of tokens) {
		if (Array.isArray(cursor)) {
			const index = asArrayIndex(token);
			if (index === null) {
				return undefined;
			}
			cursor = cursor[index];
			continue;
		}
		if (!isRecord(cursor)) {
			return undefined;
		}
		cursor = cursor[token];
	}
	return cursor;
};

const cloneShallow = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.slice();
	}
	if (isRecord(value)) {
		return { ...value };
	}
	return value;
};

const ensureContainer = (value: unknown, nextToken: string | undefined): Record<string, unknown> | unknown[] => {
	if (Array.isArray(value)) {
		return value;
	}
	if (isRecord(value)) {
		return value;
	}
	return asArrayIndex(nextToken ?? '') === null ? {} : [];
};

export const patchValueAtPointer = (root: unknown, pointer: string, nextValue: unknown): unknown => {
	const tokens = pointerToTokens(pointer);
	if (tokens.length === 0) {
		return nextValue;
	}
	const nextRoot = cloneShallow(root);
	const base =
		Array.isArray(nextRoot) || isRecord(nextRoot) ? (nextRoot as Record<string, unknown> | unknown[]) : {};

	let cursor: Record<string, unknown> | unknown[] = base;
	for (let index = 0; index < tokens.length - 1; index += 1) {
		const token = tokens[index]!;
		const afterToken = tokens[index + 1];
		if (Array.isArray(cursor)) {
			const rowIndex = asArrayIndex(token);
			if (rowIndex === null) {
				return root;
			}
			const existing = cloneShallow(cursor[rowIndex]);
			const container = ensureContainer(existing, afterToken);
			cursor[rowIndex] = container;
			cursor = container;
			continue;
		}
		const existing = cloneShallow(cursor[token]);
		const container = ensureContainer(existing, afterToken);
		cursor[token] = container;
		cursor = container;
	}

	const finalToken = tokens[tokens.length - 1]!;
	if (Array.isArray(cursor)) {
		const rowIndex = asArrayIndex(finalToken);
		if (rowIndex === null) {
			return root;
		}
		cursor[rowIndex] = nextValue;
		return base;
	}
	cursor[finalToken] = nextValue;
	return base;
};

export const tryParseJson = (content: string): unknown | null => {
	try {
		return JSON.parse(content) as unknown;
	} catch {
		return null;
	}
};

export const toPrettyJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
