import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/runtime/runtime-stage-attention.stories';
import { getPortableStory } from './portable-stories';

const DeliveryLedgerShowsObjectiveFacts = getPortableStory(stories, 'DeliveryLedgerShowsObjectiveFacts');
const QueueActionsStayExplicitInCompactViewport = getPortableStory(
	stories,
	'QueueActionsStayExplicitInCompactViewport',
);

describe('Feature: Storybook DOM contract for runtime attention stage', () => {
	test('Scenario: Given room attention with a watch reminder and explicit effect When the stage renders Then delivery facts stay separate from queued pushes and scheduler metadata', async () => {
		await DeliveryLedgerShowsObjectiveFacts.run();
	});

	test('Scenario: Given the compact runtime attention stage When a queued terminal push is promoted Then visibility and open actions stay explicit on mobile', async () => {
		await QueueActionsStayExplicitInCompactViewport.run();
	});
});
