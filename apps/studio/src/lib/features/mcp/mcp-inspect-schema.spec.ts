import { describe, expect, test } from 'vitest';

import {
	buildSchemaArgumentDraft,
	resolveCapabilityIcon,
	resolveCapabilityDescription,
	resolveCapabilityLabel,
	resolveToolInputSchema,
	stringifySchemaArgumentDraft,
} from './mcp-inspect-schema';

describe('Feature: MCP inspect schema helpers', () => {
	test('Scenario: Given a tool input schema When building a draft Then required fields get a usable JSON starter', () => {
		expect(
			buildSchemaArgumentDraft({
				type: 'object',
				required: ['path', 'options'],
				properties: {
					path: { type: 'string' },
					options: {
						type: 'object',
						required: ['recursive'],
						properties: {
							recursive: { type: 'boolean' },
							limit: { type: 'integer', minimum: 1 },
						},
					},
					patterns: {
						type: 'array',
						items: { type: 'string' },
					},
				},
			}),
		).toEqual({
			path: '',
			options: {
				recursive: false,
				limit: 1,
			},
			patterns: [''],
		});
	});

	test('Scenario: Given defaults or examples in schema When stringifying a draft Then those values seed the JSON', () => {
		expect(
			stringifySchemaArgumentDraft({
				type: 'object',
				properties: {
					message: { type: 'string', default: 'hello' },
					mode: { type: 'string', enum: ['fast', 'slow'] },
					payload: {
						oneOf: [
							{
								type: 'object',
								properties: {
									count: { type: 'integer', examples: [3] },
								},
							},
						],
					},
				},
			}),
		).toBe('{\n  "message": "hello",\n  "mode": "fast",\n  "payload": {\n    "count": 3\n  }\n}');
	});

	test('Scenario: Given raw capability payloads When reading label description and schema Then inspect stays resilient to protocol variants', () => {
		expect(resolveCapabilityLabel({ title: 'Read File' }, 'tool_1')).toBe('Read File');
		expect(resolveCapabilityLabel({ name: 'read_file', title: 'Read File', description: 'Reads a file from disk' }, 'tool_1')).toBe(
			'Read File',
		);
		expect(resolveCapabilityDescription({ description: 'Reads a file from disk' })).toBe('Reads a file from disk');
		expect(resolveCapabilityDescription({ title: 'Read File' })).toBe('');
		expect(resolveToolInputSchema({ inputSchema: { type: 'object' } })).toEqual({ type: 'object' });
		expect(resolveToolInputSchema({ schema: { type: 'object' } })).toEqual({ type: 'object' });
		expect(
			resolveToolInputSchema({
				arguments: [{ name: 'topic', required: true }],
			}),
		).toEqual({
			type: 'object',
			required: ['topic'],
			properties: {
				topic: { type: 'string' },
			},
		});
		expect(resolveToolInputSchema(null)).toBeNull();
	});

	test('Scenario: Given capability icons When resolving the preview icon Then priority stays data URI before svg before webp or png before other', () => {
		expect(
			resolveCapabilityIcon({
				icons: [
					{ src: 'https://cdn.example.com/icon.png', mimeType: 'image/png' },
					{ src: 'https://cdn.example.com/icon.svg', mimeType: 'image/svg+xml' },
					{ src: 'data:image/png;base64,abcd', mimeType: 'image/png' },
				],
			}),
		).toBe('data:image/png;base64,abcd');
		expect(
			resolveCapabilityIcon({
				icons: [
					{ src: 'https://cdn.example.com/icon.webp', mimeType: 'image/webp' },
					{ src: 'https://cdn.example.com/icon.svg' },
				],
			}),
		).toBe('https://cdn.example.com/icon.svg');
	});
});
