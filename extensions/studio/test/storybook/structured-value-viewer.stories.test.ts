import { describe, test } from 'vitest';

import * as stories from '../../src/lib/components/structured-value/structured-value-viewer.stories';
import { getPortableStory } from './portable-stories';

const MenuSwitchesTheReadOnlyCodeMirrorDocument = getPortableStory(
	stories,
	'MenuSwitchesTheReadOnlyCodeMirrorDocument',
);
const GlobalModeImmediatelyUpdatesNonOverriddenViewer = getPortableStory(
	stories,
	'GlobalModeImmediatelyUpdatesNonOverriddenViewer',
);
const LocalOverrideStaysDomLocalUntilRemount = getPortableStory(
	stories,
	'LocalOverrideStaysDomLocalUntilRemount',
);

describe('Feature: Storybook DOM contract for structured value viewer', () => {
	test('Scenario: Given a structured payload When the viewer mode changes from YAML to plain text Then the shadcn dropdown and read-only CodeMirror surface stay in sync', async () => {
		await MenuSwitchesTheReadOnlyCodeMirrorDocument.run();
	});

	test('Scenario: Given a viewer without a local override When All viewers changes Then the mounted viewer immediately tracks the global mode', async () => {
		await GlobalModeImmediatelyUpdatesNonOverriddenViewer.run();
	});

	test('Scenario: Given one viewer has a local override When the global mode changes and that DOM instance remounts Then only the remount drops back to the global mode', async () => {
		await LocalOverrideStaysDomLocalUntilRemount.run();
	});
});
