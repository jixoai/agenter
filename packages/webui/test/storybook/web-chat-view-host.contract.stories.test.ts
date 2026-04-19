import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/messages/web-chat-view-host.contract.stories';
import { getPortableStory } from './portable-stories';

const TransportAppendWhilePinnedKeepsLatestVisible = getPortableStory(
	stories,
	'TransportAppendWhilePinnedKeepsLatestVisible',
);
const TransportAppendWhileAwayKeepsAffordanceVisible = getPortableStory(
	stories,
	'TransportAppendWhileAwayKeepsAffordanceVisible',
);
const ReachingHistoryStartLoadsOlderPage = getPortableStory(stories, 'ReachingHistoryStartLoadsOlderPage');
const ScrollToLatestInterruptedByWheelKeepsTranscriptAway = getPortableStory(
	stories,
	'ScrollToLatestInterruptedByWheelKeepsTranscriptAway',
);

describe('Feature: Storybook DOM contract for web chat view host scroll ownership', () => {
	test('Scenario: Given the room transcript is pinned to latest When transport appends a newer message Then the host keeps latest visible and the latest affordance stays hidden', async () => {
		await TransportAppendWhilePinnedKeepsLatestVisible.run();
	});

	test('Scenario: Given the room transcript is away from latest When transport appends a newer message Then the host preserves the away viewport until the operator explicitly returns to latest', async () => {
		await TransportAppendWhileAwayKeepsAffordanceVisible.run();
	});

	test('Scenario: Given the room transcript reaches the history start When an older page exists Then the host requests and renders older history with older insert motion', async () => {
		await ReachingHistoryStartLoadsOlderPage.run();
	});

	test('Scenario: Given the room transcript is away from latest When return-to-latest is interrupted by wheel input Then the host keeps the transcript away and leaves the affordance visible', async () => {
		await ScrollToLatestInterruptedByWheelKeepsTranscriptAway.run();
	});
});
