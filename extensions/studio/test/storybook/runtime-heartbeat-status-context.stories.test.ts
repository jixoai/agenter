import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/runtime/runtime-heartbeat-status-context.stories';
import { getPortableStory } from './portable-stories';

const AvailableContextOpensUsageHoverCard = getPortableStory(stories, 'AvailableContextOpensUsageHoverCard');
const UnavailableContextStaysDisabled = getPortableStory(stories, 'UnavailableContextStaysDisabled');

describe('Feature: Storybook DOM contract for runtime heartbeat status context', () => {
	test('Scenario: Given runtime context usage is available When the operator hovers the trigger Then the ai-elements hover card renders its usage details without crashing', async () => {
		await AvailableContextOpensUsageHoverCard.run();
	});

	test('Scenario: Given runtime context usage is unavailable When the status bar renders Then the trigger stays disabled and no hover card content mounts', async () => {
		await UnavailableContextStaysDisabled.run();
	});
});
