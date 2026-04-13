import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/runtime/runtime-stage-heartbeat.stories';
import { getPortableStory } from './portable-stories';

const LoadingOlderKeepsHeartbeatRowsStable = getPortableStory(stories, 'LoadingOlderKeepsHeartbeatRowsStable');

describe('Feature: Storybook DOM contract for runtime heartbeat stage', () => {
	test('Scenario: Given a compact boundary in the Heartbeat stream When the stage renders and older rows are loaded Then the separator stays in the ordered virtualized list', async () => {
		await LoadingOlderKeepsHeartbeatRowsStable.run();
	});
});
