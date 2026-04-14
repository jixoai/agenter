import { describe, test } from 'vitest';

import * as stories from '../../src/lib/components/structured-value/structured-value-viewer.stories';
import { getPortableStory } from './portable-stories';

const MenuSwitchesTheReadOnlyCodeMirrorDocument = getPortableStory(
	stories,
	'MenuSwitchesTheReadOnlyCodeMirrorDocument',
);

describe('Feature: Storybook DOM contract for structured value viewer', () => {
	test('Scenario: Given a structured payload When the viewer mode changes from YAML to plain text Then the shadcn dropdown and read-only CodeMirror surface stay in sync', async () => {
		await MenuSwitchesTheReadOnlyCodeMirrorDocument.run();
	});
});
