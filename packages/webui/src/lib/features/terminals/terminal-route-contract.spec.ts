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

	test('Scenario: Given an actor-backed terminal read When the route submits the read Then the selected actor cursor is consumed explicitly', () => {
		expect(terminalRouteSource).toContain('await controller.runtimeStore.readGlobalTerminal({');
		expect(terminalRouteSource).toContain('accessToken,');
		expect(terminalRouteSource).toContain('remark: true,');
	});

	test('Scenario: Given a selected call-as seat token When the route binds the terminal viewport Then the live transport URL is re-derived from that token instead of reusing a stale catalog URL', () => {
		expect(terminalRouteSource).toContain("const buildTransportUrlForToken = (token?: string | null): string | null => {");
		expect(terminalRouteSource).toContain("url.searchParams.set('token', token);");
		expect(terminalRouteSource).toContain('const selectedTransportUrl = $derived(buildTransportUrlForToken(selectedCallerToken));');
		expect(terminalRouteSource).toContain('{selectedTransportUrl}');
	});
});
