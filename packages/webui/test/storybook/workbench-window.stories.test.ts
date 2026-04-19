import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/navigation/workbench-window.stories';
import { getPortableStory } from './portable-stories';

const ChromeFusesIntoBodySurface = getPortableStory(stories, 'ChromeFusesIntoBodySurface');
const CompactDetailTakeoverRestoresRouteToolbar = getPortableStory(
	stories,
	'CompactDetailTakeoverRestoresRouteToolbar',
);
const BodyScrollOwnsOverflowingPageContent = getPortableStory(stories, 'BodyScrollOwnsOverflowingPageContent');

describe('Feature: Storybook DOM contract for workbench window', () => {
	test('Scenario: Given a workbench window When chrome and page body render Then the toolbar and body remain fused into one shell surface', async () => {
		await ChromeFusesIntoBodySurface.run();
	});

	test('Scenario: Given compact detail takeover When the sheet opens and closes Then toolbar close ownership is shared and reversible', async () => {
		await CompactDetailTakeoverRestoresRouteToolbar.run();
	});

	test('Scenario: Given overflowing route content When the shared workbench body renders Then the body viewport owns scroll instead of clipping page content', async () => {
		await BodyScrollOwnsOverflowingPageContent.run();
	});
});
