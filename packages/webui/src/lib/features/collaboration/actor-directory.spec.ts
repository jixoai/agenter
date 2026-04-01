import { describe, expect, test } from 'vitest';

import { buildActorDirectory, buildActorDirectoryMap, fallbackActorLabel } from './actor-directory';

describe('Feature: collaboration actor directory', () => {
	test('Scenario: Given bootstrap system actors When building the actor directory Then shared UI surfaces resolve the canonical bootstrap label', () => {
		const directory = buildActorDirectory({
			sessions: [],
			authActors: [],
			profileIconUrl: () => null,
			sessionIconUrl: () => null,
		});
		const directoryMap = buildActorDirectoryMap(directory);

		expect(directoryMap.get('system:trusted-terminal-bootstrap')?.label).toBe('Bootstrap admin');
		expect(directoryMap.get('system:trusted-bootstrap')?.label).toBe('Bootstrap admin');
		expect(fallbackActorLabel('system:trusted-terminal-bootstrap')).toBe('Bootstrap admin');
	});
});
