import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/workspaces/workspace-manage-dialog.stories';
import { getPortableStory } from './portable-stories';

const MountUnmountAndLensSelection = getPortableStory(stories, 'MountUnmountAndLensSelection');

describe('Feature: Storybook DOM contract for workspace management dialog', () => {
	test('Scenario: Given the workspace dialog owns mount state When avatars are mounted unmounted and opened Then the shell stays outside the dialog while list state updates inline', async () => {
		await MountUnmountAndLensSelection.run();
	});
});
