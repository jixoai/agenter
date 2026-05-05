import { describe, expect, test } from 'vitest';
import type { GlobalTerminalEntry } from '@agenter/client-sdk';

import {
	resolveTerminalIdentitySubtitle,
	resolveTerminalInstanceName,
	resolveTerminalWindowTitle,
} from './terminal-display';

const createTerminalEntry = (overrides: Partial<GlobalTerminalEntry> = {}): GlobalTerminalEntry => ({
	terminalId: 'term-qa',
	processKind: 'shell',
	command: ['/bin/bash'],
	launchCwd: '/repo',
	workspace: null,
	status: 'IDLE',
	processPhase: 'running',
	seq: 0,
	focused: false,
	rendererPreference: 'auto',
	theme: 'default-dark',
	cursor: 'block',
	font: {
		family: "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
		sizePx: 14,
		lineHeight: 1,
		letterSpacing: 0,
		weight: '400',
		weightBold: '700',
		ligatures: true,
	},
	...overrides,
});

describe('Feature: terminal display law', () => {
	test('Scenario: Given a PTY changes its observed title When tab and toolbar labels resolve Then terminal instance surfaces stay on the configured instance name', () => {
		const terminal = createTerminalEntry({
			configuredTitle: 'Claude Code',
			currentTitle: 'qa-regression',
			currentPath: '/repo/tmp',
		});

		expect(resolveTerminalInstanceName(terminal)).toBe('Claude Code');
		expect(resolveTerminalIdentitySubtitle(terminal)).toBe('/repo/tmp');
	});

	test('Scenario: Given a PTY changes its observed title When the window title resolves Then only the terminal window follows the live PTY title', () => {
		const terminal = createTerminalEntry({
			configuredTitle: 'Claude Code',
			currentTitle: 'qa-regression',
		});

		expect(resolveTerminalWindowTitle(terminal)).toBe('qa-regression');
	});

	test('Scenario: Given no configured instance name exists When labels resolve Then terminal identity falls back to terminal id without inventing a subtitle', () => {
		const terminal = createTerminalEntry({
			processPhase: 'stopped',
		});

		expect(resolveTerminalInstanceName(terminal)).toBe('term-qa');
		expect(resolveTerminalWindowTitle(terminal)).toBe('term-qa');
		expect(resolveTerminalIdentitySubtitle(terminal)).toBe('');
	});
});
