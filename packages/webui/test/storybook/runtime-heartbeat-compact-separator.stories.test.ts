import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/runtime/runtime-heartbeat-compact-separator.stories';
import { getPortableStory } from './portable-stories';

const CompactBoundaryRendersAsCenteredSeparator = getPortableStory(
	stories,
	'CompactBoundaryRendersAsCenteredSeparator',
);

describe('Feature: Storybook DOM contract for runtime heartbeat compact separator', () => {
	test('Scenario: Given a compact heartbeat boundary When rendering the separator Then the operator sees a centered context reset marker instead of a chat bubble', async () => {
		await CompactBoundaryRendersAsCenteredSeparator.run();
	});
});
