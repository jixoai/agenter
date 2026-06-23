import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const avatarCreateRouteSource = readFileSync(resolve(import.meta.dirname, 'avatar-create-route.svelte'), 'utf8');

describe('Feature: Avatar create route durable draft contract', () => {
	test('Scenario: Given the avatar create page is loading When the catalog has no data Then Skeletons stand in only for missing draft and source facts', () => {
		expect(avatarCreateRouteSource).toContain("import AvatarLoadingSkeleton from './avatar-loading-skeleton.svelte';");
		expect(avatarCreateRouteSource).toContain("const sourceLoadingWithoutData = $derived(!avatarCatalogState.loaded && avatarCatalogState.loading && avatars.length === 0)");
		expect(avatarCreateRouteSource).toContain("const sourceRefreshingWithData = $derived(avatarCatalogState.refreshing && avatars.length > 0)");
		expect(avatarCreateRouteSource).toContain("const shouldRenderDraftSkeleton = $derived(!draftReady)");
		expect(avatarCreateRouteSource).toContain('<AvatarLoadingSkeleton variant="draft" />');
		expect(avatarCreateRouteSource).toContain('<AvatarLoadingSkeleton variant="catalog-list" rows={1} class="rounded-md border border-border/50" />');
		expect(avatarCreateRouteSource).toContain('<AvatarLoadingSkeleton variant="catalog-detail" class="contents" />');
		expect(avatarCreateRouteSource).toContain('data-testid="avatar-create-source-refreshing"');
		expect(avatarCreateRouteSource).not.toContain("Loading avatar catalog");
	});

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
