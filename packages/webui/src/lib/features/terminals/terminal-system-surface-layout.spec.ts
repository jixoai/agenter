import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
	TERMINAL_USERS_PANE_COMPACT_WIDTH,
	resolveTerminalUsersPaneLayout,
} from './terminal-system-surface-layout';

const terminalSystemSurfaceSource = readFileSync(
	resolve(import.meta.dirname, 'terminal-system-surface.svelte'),
	'utf8',
);

describe('Feature: Terminal users pane responsive grant layout', () => {
	test('Scenario: Given a narrow collaboration rail When resolving the users pane layout Then the stacked grant controls are used', () => {
		expect(TERMINAL_USERS_PANE_COMPACT_WIDTH).toBe(480);
		expect(resolveTerminalUsersPaneLayout(344)).toBe('compact');
		expect(resolveTerminalUsersPaneLayout(479)).toBe('compact');
		expect(resolveTerminalUsersPaneLayout(480)).toBe('wide');
		expect(resolveTerminalUsersPaneLayout(640)).toBe('wide');
	});

	test('Scenario: Given the terminal users pane source When reading the responsive law Then local pane width drives the fallback instead of viewport matchMedia', () => {
		expect(terminalSystemSurfaceSource).toContain(
			"import { resolveTerminalUsersPaneLayout } from './terminal-system-surface-layout';",
		);
		expect(terminalSystemSurfaceSource).toContain('let usersPanelRef = $state<HTMLElement | null>(null);');
		expect(terminalSystemSurfaceSource).toContain(
			"const usersPaneCompact = $derived(resolveTerminalUsersPaneLayout(usersPanelWidth) === 'compact');",
		);
		expect(terminalSystemSurfaceSource).toContain('new ResizeObserver((entries) => {');
		expect(terminalSystemSurfaceSource).not.toContain("window.matchMedia('(max-width: 1023.98px)')");
	});
});
