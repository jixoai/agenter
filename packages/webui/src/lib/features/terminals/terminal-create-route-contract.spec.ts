import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const createRouteSource = readFileSync(resolve(import.meta.dirname, 'terminal-create-route.svelte'), 'utf8');

describe('Feature: Terminal create route focus handoff', () => {
	test('Scenario: Given a successful terminal creation When reading the create route source Then the catalog hydrates before navigation and the created terminal id becomes the canonical destination', () => {
		expect(createRouteSource).toContain('const createdTerminalId = created.terminal?.terminalId;');
		expect(createRouteSource).toContain("throw new Error('created terminal id is unavailable');");
		expect(createRouteSource).toContain('await controller.runtimeStore.hydrateGlobalTerminals({ force: true });');
		expect(createRouteSource).toContain('await goto(`/terminals/${encodeURIComponent(createdTerminalId)}`, {');
		expect(createRouteSource).not.toContain("await goto(`/terminals/${encodeURIComponent(created.terminal?.terminalId ?? '')}`);");
	});

	test('Scenario: Given the browser is not authenticated When reading the create route source Then terminal creation is disabled behind an explicit auth-required notice', () => {
		expect(createRouteSource).toContain("const AUTH_REQUIRED_MESSAGE = 'auth token required';");
		expect(createRouteSource).toContain('const authReady = $derived(!controller.initializing);');
		expect(createRouteSource).toContain('const isAuthenticated = $derived(Boolean(controller.authSession));');
		expect(createRouteSource).toContain('const showAuthNotice = $derived(authReady && !isAuthenticated);');
		expect(createRouteSource).toContain('if (!authReady || !isAuthenticated) {');
		expect(createRouteSource).toContain('errorMessage = AUTH_REQUIRED_MESSAGE;');
		expect(createRouteSource).toContain('disabled={createBusy || !authReady || !isAuthenticated}');
		expect(createRouteSource).toContain('<NoticeBanner tone="destructive" message={routeErrorMessage} />');
	});
});
