import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/skills/skill-preview-pane.stories';
import { getPortableStory } from './portable-stories';

const TextPreviewUsesFilePreviewer = getPortableStory(stories, 'TextPreviewUsesFilePreviewer');

describe('Feature: Storybook DOM contract for the Skills preview pane', () => {
	test('Scenario: Given a text preview payload When the pane renders Then filePreviewer receives the routed iframe contract', async () => {
		await TextPreviewUsesFilePreviewer.run();
	});
});
