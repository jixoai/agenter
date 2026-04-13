import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/settings/workspace-settings-panel.stories';
import { getPortableStory } from './portable-stories';

const SwitchingLayersKeepsProvenanceVisible = getPortableStory(stories, 'SwitchingLayersKeepsProvenanceVisible');

describe('Feature: Storybook DOM contract for workspace settings panel', () => {
	test('Scenario: Given a settings provenance panel When the operator switches layers and saves Then the detail editor stays attached to the selected source layer', async () => {
		await SwitchingLayersKeepsProvenanceVisible.run();
	});
});
