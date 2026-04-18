import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const avatarCreateRouteSource = readFileSync(resolve(import.meta.dirname, 'avatar-create-route.svelte'), 'utf8');

describe('Feature: Avatar create route durable draft contract', () => {
	test('Scenario: Given avatar creation completes When reading the route source Then navigation waits for durable draft cleanup instead of swallowing delete failure', () => {
		expect(avatarCreateRouteSource).toContain('const removeDurableDraft = async');
		expect(avatarCreateRouteSource).toContain(
			'Avatar was created, but the durable draft could not be cleared. Discard the draft before leaving this page.',
		);
		expect(avatarCreateRouteSource).not.toContain('Best-effort cleanup only. Avatar creation itself already succeeded.');
	});

	test('Scenario: Given discarding a draft touches durable truth When reading the route source Then discard waits for hydrate and save failures surface explicit draft status', () => {
		expect(avatarCreateRouteSource).toMatch(
			/disabled=\{createBusy \|\| discardBusy \|\| !draftReady \|\| draftMissing\}/,
		);
		expect(avatarCreateRouteSource).toContain(
			'Draft is still loading. Wait for the durable draft to finish loading before discarding it.',
		);
		expect(avatarCreateRouteSource).toContain(
			'Draft changed elsewhere. Latest version has been loaded. Review it before discarding it.',
		);
		expect(avatarCreateRouteSource).toContain('Failed to save avatar draft.');
	});
});
