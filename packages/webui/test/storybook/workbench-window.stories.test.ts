import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/navigation/workbench-window.stories';
import { getPortableStory } from './portable-stories';

const ChromeFusesIntoBodySurface = getPortableStory(stories, 'ChromeFusesIntoBodySurface');

describe('Feature: Storybook DOM contract for workbench window', () => {
	test('Scenario: Given a workbench window When chrome and page body render Then the toolbar and body remain fused into one shell surface', async () => {
		await ChromeFusesIntoBodySurface.run();
	});
});
