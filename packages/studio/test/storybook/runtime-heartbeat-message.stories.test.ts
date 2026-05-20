import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/runtime/runtime-heartbeat-message.stories';
import { getPortableStory } from './portable-stories';

const AssistantHeartbeatMessageShowsAttachmentsAndToolState = getPortableStory(
	stories,
	'AssistantHeartbeatMessageShowsAttachmentsAndToolState',
);

describe('Feature: Storybook DOM contract for runtime heartbeat message', () => {
	test('Scenario: Given an assistant heartbeat row When attachments and tool metadata render Then the primitive stays readable without taking over scroll ownership', async () => {
		await AssistantHeartbeatMessageShowsAttachmentsAndToolState.run();
	});
});
