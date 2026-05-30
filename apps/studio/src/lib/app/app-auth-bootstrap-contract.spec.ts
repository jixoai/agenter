import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const appControllerSource = readFileSync(resolve(import.meta.dirname, 'app-controller.svelte.ts'), 'utf8');
const appShellLayoutSource = readFileSync(resolve(import.meta.dirname, '../../routes/(app)/+layout.svelte'), 'utf8');

describe('Feature: App auth bootstrap contract', () => {
	test('Scenario: Given the browser starts without a verified session When reading the app controller source Then bootstrap checks stored auth first and only hydrates the protected runtime after authentication succeeds', () => {
		expect(appControllerSource).toContain("authBootstrapState: 'connecting'");
		expect(appControllerSource).toContain("controller.authBootstrapState = 'checking-session';");
		expect(appControllerSource).toContain("const storedSession = await runtimeStore.getAuthSession();");
		expect(appControllerSource).toContain('runtimeStore.clearAuthToken();');
		expect(appControllerSource).toContain("controller.authBootstrapState = 'auto-login';");
		expect(appControllerSource).toContain('const autoLogin = await runtimeStore.autoLogin();');
		expect(appControllerSource).toContain("controller.authBootstrapState = 'authenticated';");
		expect(appControllerSource).toContain('await hydrateAuthenticatedState();');
		expect(appControllerSource).toContain("controller.authBootstrapState = 'needs-login';");
		expect(appControllerSource).toContain("controller.authBootstrapState = 'error';");
		expect(appControllerSource).toContain("controller.statusText = 'Attempting daemon auto login…';");
		expect(appControllerSource).toContain('writeStoredAuthToken(autoLogin.session.token);');
	});

	test('Scenario: Given the browser is not authenticated When reading the root layout source Then the protected app shell stays gated behind the onboarding dialog instead of rendering the current page', () => {
		expect(appShellLayoutSource).toContain(
			"const isAuthenticated = $derived(controller.authBootstrapState === 'authenticated' && Boolean(controller.authSession));",
		);
		expect(appShellLayoutSource).toContain('{#if isAuthenticated}');
		expect(appShellLayoutSource).toContain('<AppShell {controller}>');
		expect(appShellLayoutSource).toContain('{@render children()}');
		expect(appShellLayoutSource).toContain('<SuperadminOnboardingDialog');
		expect(appShellLayoutSource).toContain('open={true}');
		expect(appShellLayoutSource).toContain('allowDismiss={false}');
		expect(appShellLayoutSource).toContain("onStoreAutoLoginKey={() => controller.storeAutoLoginKey(privateKeyDraft)}");
		expect(appShellLayoutSource).toContain("onAuthenticate={() => controller.authenticateWithPrivateKey(privateKeyDraft)}");
	});
});
