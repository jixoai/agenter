import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/workspaces/workspace-shell.stories.svelte';
import { getPortableStory } from './portable-stories';

const ModeSwitchingKeepsSharedShell = getPortableStory(stories, 'ModeSwitchingKeepsSharedShell');
const AvatarLensKeepsRootContext = getPortableStory(stories, 'AvatarLensKeepsRootContext');
const TreeDisclosureStaysInSurface = getPortableStory(stories, 'TreeDisclosureStaysInSurface');

describe('Feature: Storybook DOM contract for workspace shell', () => {
	test('Scenario: Given workspace mode switching When Explorer Rules and Private swap Then the shared shell keeps one stable header and body contract', async () => {
		await ModeSwitchingKeepsSharedShell.run();
	});

	test('Scenario: Given the shared content header When the avatar lens changes Then the selected workspace root stays fixed', async () => {
		await AvatarLensKeepsRootContext.run();
	});

	test('Scenario: Given the workspace tree When directory disclosure toggles Then children stay inside the same explicit viewport', async () => {
		await TreeDisclosureStaysInSurface.run();
	});
});
