import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scanRoots = [
	resolve(packageRoot, 'src/lib/features'),
	resolve(packageRoot, 'src/routes'),
	resolve(packageRoot, 'src/lib/components'),
];
const forbiddenPattern = /\boverflow-(?:auto|scroll|x-auto|y-auto|x-scroll|y-scroll)\b/u;

const walkFiles = (root: string): string[] => {
	const results: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const nextPath = join(root, entry.name);
		if (entry.isDirectory()) {
			if (relative(packageRoot, nextPath).startsWith('src/lib/components/ui')) {
				continue;
			}
			results.push(...walkFiles(nextPath));
			continue;
		}
		if (!['.svelte', '.ts'].includes(extname(entry.name))) {
			continue;
		}
		results.push(nextPath);
	}
	return results;
};

describe('Feature: ScrollView source contract', () => {
	test('Scenario: Given WebUI feature and route code When scanning for raw scroll ownership Then only shared UI primitives may keep overflow-based scrolling', () => {
		const violations = scanRoots
			.flatMap((root) => walkFiles(root))
			.filter((filePath) => forbiddenPattern.test(readFileSync(filePath, 'utf8')))
			.map((filePath) => relative(packageRoot, filePath));

		expect(violations).toEqual([]);
	});
});
