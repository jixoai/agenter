import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/navigation/workbench-tab-strip.stories.svelte';
import { getPortableStory } from './portable-stories';

const HoveringRuntimeTabShowsTooltip = getPortableStory(stories, 'HoveringRuntimeTabShowsTooltip');
const ContextMenuCloseFallsBackSelection = getPortableStory(stories, 'ContextMenuCloseFallsBackSelection');
const NarrowToolbarStaysSingleSurface = getPortableStory(stories, 'NarrowToolbarStaysSingleSurface');

describe('Feature: Storybook DOM contract for workbench tab strip', () => {
	test('Scenario: Given a runtime tab When it is hovered Then tooltip detail and fused status indicators stay visible', async () => {
		await HoveringRuntimeTabShowsTooltip.run();
	});

	test('Scenario: Given a running tab When its context menu closes the tab Then selection falls back predictably', async () => {
		await ContextMenuCloseFallsBackSelection.run();
	});

	test('Scenario: Given a narrow workbench chrome When toolbar content reflows Then metadata stays visible and hover actions collapse without horizontal overflow', async () => {
		await NarrowToolbarStaysSingleSurface.run();
	});
});
