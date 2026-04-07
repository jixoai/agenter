import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const routesRoot = resolve(import.meta.dirname, '../../../routes');

const readRoute = (relativePath: string): string =>
	readFileSync(resolve(routesRoot, relativePath), 'utf8');

describe('Feature: Redirect-only WebUI entry pages', () => {
	test('Scenario: Given redirect-only shell entries When reading the route sources Then they stay on server entry files with canonical destinations', () => {
		expect(existsSync(resolve(routesRoot, '+page.server.ts'))).toBe(true);
		expect(existsSync(resolve(routesRoot, '+page.ts'))).toBe(false);
		expect(readRoute('+page.server.ts')).toContain("throw redirect(307, '/avatars');");

		expect(existsSync(resolve(routesRoot, 'avatars/+page.server.ts'))).toBe(true);
		expect(existsSync(resolve(routesRoot, 'avatars/+page.ts'))).toBe(false);
		expect(readRoute('avatars/+page.server.ts')).toContain("throw redirect(307, '/avatars/workspace');");

		expect(existsSync(resolve(routesRoot, 'avatars/runtime/[sessionId]/+page.server.ts'))).toBe(true);
		expect(existsSync(resolve(routesRoot, 'avatars/runtime/[sessionId]/+page.ts'))).toBe(false);
		expect(readRoute('avatars/runtime/[sessionId]/+page.server.ts')).toContain(
			"throw redirect(307, `/avatars/runtime/${encodeURIComponent(params.sessionId)}/attention`);",
		);
	});
});
