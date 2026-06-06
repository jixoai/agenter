import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/mcp/mcp-workbench.stories';
import { getPortableStory } from './portable-stories';

const NoRuntimeState = getPortableStory(stories, 'NoRuntimeState');
const GlobalOnlyNewConfig = getPortableStory(stories, 'GlobalOnlyNewConfig');
const DefaultDisabledProject = getPortableStory(stories, 'DefaultDisabledProject');
const EnabledStoppedProject = getPortableStory(stories, 'EnabledStoppedProject');
const RunningProjectTestCall = getPortableStory(stories, 'RunningProjectTestCall');
const FailedProject = getPortableStory(stories, 'FailedProject');
const BlockedRemove = getPortableStory(stories, 'BlockedRemove');

describe('Feature: Storybook DOM contract for MCP workbench states', () => {
	test('Scenario: Given no running runtime When MCP opens Then runtime authority is required before actions', async () => {
		await NoRuntimeState.run();
	});

	test('Scenario: Given global-only mode When New is visible Then global add remains separate from project enablement', async () => {
		await GlobalOnlyNewConfig.run();
	});

	test('Scenario: Given default-disabled projection When row is selected Then lifecycle controls stay gated', async () => {
		await DefaultDisabledProject.run();
	});

	test('Scenario: Given enabled stopped projection When lifecycle controls render Then start and restart are available', async () => {
		await EnabledStoppedProject.run();
	});

	test('Scenario: Given running projection When a tool test call runs Then autoEnable remains explicit and result is structured', async () => {
		await RunningProjectTestCall.run();
	});

	test('Scenario: Given failed projection When detail renders Then latest error and failed state stay visible', async () => {
		await FailedProject.run();
	});

	test('Scenario: Given running projects block remove When remove is attempted Then blocked paths remain visible until stop is explicit', async () => {
		await BlockedRemove.run();
	});
});
