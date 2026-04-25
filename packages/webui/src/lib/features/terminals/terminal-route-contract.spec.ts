import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const terminalRouteSource = readFileSync(resolve(import.meta.dirname, 'terminal-route.svelte'), 'utf8');

describe('Feature: Terminal route activity hydration contract', () => {
	test('Scenario: Given the global terminal activity rail hydrates on route mount When reading the route source Then first paint only requests a compact page instead of the historical 120-row burst', () => {
		expect(terminalRouteSource).toContain('const GLOBAL_TERMINAL_ACTIVITY_LIMIT = 20;');
		expect(terminalRouteSource).toContain(
			'.hydrateGlobalTerminalActivity({ terminalId: currentTerminalId, limit: GLOBAL_TERMINAL_ACTIVITY_LIMIT })',
		);
		expect(terminalRouteSource).not.toContain('.hydrateGlobalTerminalActivity({ terminalId: currentTerminalId, limit: 120 })');
	});
});
