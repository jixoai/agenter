import { describe, expect, test } from 'vitest';

import { buildJsonViewerDocument } from './json-viewer-content';
import { DEFAULT_JSON_VIEWER_MODE, resolveJsonViewerMode } from './json-viewer-mode';

describe('Feature: Structured value viewer document resolution', () => {
	test('Scenario: Given no local override When resolving the viewer mode Then the YAML-first default remains active', () => {
		expect(resolveJsonViewerMode({ localMode: null, globalMode: null })).toBe(DEFAULT_JSON_VIEWER_MODE);
		expect(resolveJsonViewerMode({ localMode: 'raw-text-json', globalMode: 'highlight-yaml' })).toBe(
			'raw-text-json',
		);
	});

	test('Scenario: Given a structured payload When building YAML and JSON documents Then each mode produces the expected serialized text', () => {
		const payload = {
			status: 'ok',
			count: 2,
			nested: {
				kind: 'assistant',
			},
		};

		expect(
			buildJsonViewerDocument({
				mode: 'highlight-yaml',
				value: payload,
				rawText: '',
			}).text,
		).toContain('status: ok');
		expect(
			buildJsonViewerDocument({
				mode: 'fmt-highlight-json',
				value: payload,
				rawText: '',
			}).text,
		).toContain('"nested": {');
		expect(
			buildJsonViewerDocument({
				mode: 'raw-text-json',
				value: payload,
				rawText: '{"status":"ok","count":2}',
			}).text,
		).toBe('{"status":"ok","count":2}');
	});
});
