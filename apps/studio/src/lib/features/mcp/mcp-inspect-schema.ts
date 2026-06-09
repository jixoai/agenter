type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneJsonValue = (value: JsonValue): JsonValue => {
	if (Array.isArray(value)) {
		return value.map(cloneJsonValue);
	}
	if (isRecord(value)) {
		return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneJsonValue(entry as JsonValue)]));
	}
	return value;
};

const asJsonValue = (value: unknown): JsonValue | undefined => {
	if (value === null) {
		return null;
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}
	if (Array.isArray(value)) {
		const entries = value
			.map((entry) => asJsonValue(entry))
			.filter((entry): entry is JsonValue => entry !== undefined);
		return entries;
	}
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value)
				.map(([key, entry]) => {
					const jsonEntry = asJsonValue(entry);
					return jsonEntry === undefined ? null : ([key, jsonEntry] as const);
				})
				.filter((entry): entry is readonly [string, JsonValue] => entry !== null),
		);
	}
	return undefined;
};

const firstArrayValue = (value: unknown): unknown[] =>
	Array.isArray(value) ? value : [];

const inferFromSchema = (schema: unknown, depth = 0): JsonValue => {
	if (depth > 6 || !isRecord(schema)) {
		return '';
	}

	const defaultValue = asJsonValue(schema.default);
	if (defaultValue !== undefined) {
		return cloneJsonValue(defaultValue);
	}

	const examples = firstArrayValue(schema.examples);
	if (examples.length > 0) {
		const exampleValue = asJsonValue(examples[0]);
		if (exampleValue !== undefined) {
			return cloneJsonValue(exampleValue);
		}
	}

	if (schema.const !== undefined) {
		const constValue = asJsonValue(schema.const);
		if (constValue !== undefined) {
			return cloneJsonValue(constValue);
		}
	}

	const enumValues = firstArrayValue(schema.enum);
	if (enumValues.length > 0) {
		const enumValue = asJsonValue(enumValues[0]);
		if (enumValue !== undefined) {
			return cloneJsonValue(enumValue);
		}
	}

	const anyOf = firstArrayValue(schema.anyOf);
	if (anyOf.length > 0) {
		return inferFromSchema(anyOf[0], depth + 1);
	}
	const oneOf = firstArrayValue(schema.oneOf);
	if (oneOf.length > 0) {
		return inferFromSchema(oneOf[0], depth + 1);
	}
	const allOf = firstArrayValue(schema.allOf);
	if (allOf.length > 0) {
		return inferFromSchema(allOf[0], depth + 1);
	}

	const schemaType = schema.type;
	if (Array.isArray(schemaType)) {
		const preferred = schemaType.find((entry) => entry !== 'null');
		if (preferred) {
			return inferFromSchema({ ...schema, type: preferred }, depth + 1);
		}
	}

	if (schemaType === 'object' || isRecord(schema.properties)) {
		const properties = isRecord(schema.properties) ? schema.properties : {};
		const required = new Set(firstArrayValue(schema.required).filter((entry): entry is string => typeof entry === 'string'));
		const result: Record<string, JsonValue> = {};
		for (const [key, propertySchema] of Object.entries(properties)) {
			if (!required.has(key) && !isRecord(propertySchema)) {
				continue;
			}
			result[key] = inferFromSchema(propertySchema, depth + 1);
		}
		return result;
	}

	if (schemaType === 'array') {
		if (schema.items) {
			return [inferFromSchema(schema.items, depth + 1)];
		}
		return [];
	}

	if (schemaType === 'integer' || schemaType === 'number') {
		const minimum = typeof schema.minimum === 'number' ? schema.minimum : 0;
		return minimum;
	}

	if (schemaType === 'boolean') {
		return false;
	}

	if (schemaType === 'null') {
		return null;
	}

	return '';
};

export const buildSchemaArgumentDraft = (schema: unknown): Record<string, JsonValue> => {
	const inferred = inferFromSchema(schema);
	return isRecord(inferred) ? inferred : {};
};

export const stringifySchemaArgumentDraft = (schema: unknown): string =>
	JSON.stringify(buildSchemaArgumentDraft(schema), null, 2);

export const resolveToolInputSchema = (value: unknown): unknown | null => {
	if (!isRecord(value)) {
		return null;
	}
	if (value.inputSchema ?? value.schema) {
		return value.inputSchema ?? value.schema ?? null;
	}
	if (Array.isArray(value.arguments)) {
		const argumentEntries = value.arguments
			.filter(
				(entry): entry is Record<string, unknown> =>
					isRecord(entry) && typeof entry.name === 'string' && entry.name.trim().length > 0,
			)
			.map((entry) => {
				const name = String(entry.name).trim();
				const schema = isRecord(entry.schema) ? entry.schema : { type: 'string' };
				return [name, schema] as const;
			});
		if (argumentEntries.length === 0) {
			return null;
		}
		return {
			type: 'object',
			required: value.arguments
				.filter((entry): entry is Record<string, unknown> => isRecord(entry) && entry.required === true)
				.map((entry) => String(entry.name)),
			properties: Object.fromEntries(argumentEntries),
		};
	}
	return null;
};

export const resolveCapabilityLabel = (value: unknown, fallback: string): string => {
	if (!isRecord(value)) {
		return fallback;
	}
	for (const key of ['name', 'title', 'uri'] as const) {
		const candidate = value[key];
		if (typeof candidate === 'string' && candidate.trim().length > 0) {
			return candidate.trim();
		}
	}
	return fallback;
};

export const resolveCapabilityDescription = (value: unknown): string => {
	if (!isRecord(value)) {
		return '';
	}
	const candidate = value.description;
	if (typeof candidate === 'string' && candidate.trim().length > 0) {
		return candidate.trim();
	}
	return '';
};

type IconSource = {
	src: string;
	mimeType?: string;
};

export const resolveCapabilityIcon = (value: unknown): string | null => {
	if (!isRecord(value) || !Array.isArray(value.icons)) {
		return null;
	}
	const icons = value.icons
		.filter((entry): entry is IconSource => isRecord(entry) && typeof entry.src === 'string' && entry.src.trim().length > 0)
		.map((entry) => ({
			src: entry.src.trim(),
			mimeType: typeof entry.mimeType === 'string' ? entry.mimeType.trim().toLowerCase() : undefined,
		}));
	if (icons.length === 0) {
		return null;
	}

	const scoreIcon = (icon: IconSource): number => {
		const lowerSrc = icon.src.toLowerCase();
		const mimeType = icon.mimeType ?? '';
		if (lowerSrc.startsWith('data:')) {
			return 400;
		}
		if (mimeType === 'image/svg+xml' || lowerSrc.endsWith('.svg')) {
			return 300;
		}
		if (mimeType === 'image/webp' || lowerSrc.endsWith('.webp')) {
			return 200;
		}
		if (mimeType === 'image/png' || lowerSrc.endsWith('.png')) {
			return 190;
		}
		return 100;
	};

	return icons.sort((left, right) => scoreIcon(right) - scoreIcon(left))[0]?.src ?? null;
};
