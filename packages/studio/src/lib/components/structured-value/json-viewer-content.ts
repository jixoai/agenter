import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { yaml as yamlLanguage } from '@codemirror/lang-yaml';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { stringify as stringifyYaml } from 'yaml';

import type { JsonViewerMode } from './json-viewer-mode';

export interface JsonViewerDocument {
	mode: JsonViewerMode;
	text: string;
	language: Extension;
}

const EMPTY_LANGUAGE: Extension[] = [];
const STRUCTURED_VALUE_HIGHLIGHTING = syntaxHighlighting(
	HighlightStyle.define([
		{ tag: t.propertyName, color: '#64748b' },
		{ tag: [t.string, t.special(t.string)], color: '#0f766e' },
		{ tag: [t.number, t.integer, t.float], color: '#b45309' },
		{ tag: [t.bool, t.null], color: '#475569', fontStyle: 'italic' },
		{ tag: [t.keyword, t.atom], color: '#0369a1' },
		{ tag: [t.brace, t.squareBracket, t.separator], color: '#94a3b8' },
	]),
);

const serializeJson = (value: unknown): string => {
	return JSON.stringify(value, null, 2) ?? 'null';
};

const serializeYaml = (value: unknown): string => {
	return stringifyYaml(value, {
		indent: 2,
		lineWidth: 0,
	}).trimEnd();
};

const resolveRawText = (value: unknown, rawText: string): string => {
	return rawText.length > 0 ? rawText : serializeJson(value);
};

const resolveLanguage = (mode: JsonViewerMode): Extension => {
	switch (mode) {
		case 'highlight-yaml':
			return [yamlLanguage(), STRUCTURED_VALUE_HIGHLIGHTING];
		case 'fmt-highlight-json':
			return [json(), STRUCTURED_VALUE_HIGHLIGHTING];
		default:
			return EMPTY_LANGUAGE;
	}
};

export const buildJsonViewerDocument = (input: {
	mode: JsonViewerMode;
	value: unknown;
	rawText: string;
}): JsonViewerDocument => {
	const text =
		input.mode === 'highlight-yaml'
			? serializeYaml(input.value)
			: input.mode === 'fmt-highlight-json'
				? serializeJson(input.value)
				: resolveRawText(input.value, input.rawText);

	return {
		mode: input.mode,
		text,
		language: resolveLanguage(input.mode),
	};
};
