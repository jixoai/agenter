import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/skills/skills-skill-browser.stories';
import { getPortableStory } from './portable-stories';

const TextSelectionOpensReadOnlyPreview = getPortableStory(stories, 'TextSelectionOpensReadOnlyPreview');
const MediaSelectionUsesIsolatedPreviewer = getPortableStory(stories, 'MediaSelectionUsesIsolatedPreviewer');
const SplitDetailResizeShieldsIframePreview = getPortableStory(stories, 'SplitDetailResizeShieldsIframePreview');
const CompactSelectionKeepsPreviewReachable = getPortableStory(stories, 'CompactSelectionKeepsPreviewReachable');

describe('Feature: Storybook DOM contract for the Skills browser', () => {
	test('Scenario: Given one expanded skill When a text file is selected Then the shared detail surface resolves the text preview metadata', async () => {
		await TextSelectionOpensReadOnlyPreview.run();
	});

	test('Scenario: Given one expanded skill When an image file is selected Then the detail pane embeds the isolated filePreviewer iframe', async () => {
		await MediaSelectionUsesIsolatedPreviewer.run();
	});

	test('Scenario: Given split detail contains an iframe When resizing crosses the preview Then drag ownership stays in the parent shell', async () => {
		await SplitDetailResizeShieldsIframePreview.run();
	});

	test('Scenario: Given a compact skills browser When a text file is selected Then filePreviewer still opens through the compact detail drawer law', async () => {
		await CompactSelectionKeepsPreviewReachable.run();
	});
});
