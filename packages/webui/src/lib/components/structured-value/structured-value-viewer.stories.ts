import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import StructuredValueViewerStoryHarness from './structured-value-viewer.story-harness.svelte';
import {
	DEFAULT_JSON_VIEWER_MODE,
	setGlobalJsonViewerMode,
} from './json-viewer-mode';
import StructuredValueViewer from './structured-value-viewer.svelte';

const rawText = '{"status":"ok","count":2,"nested":{"kind":"assistant"}}';

const waitForInteractiveTrigger = async (trigger: HTMLElement): Promise<void> => {
	await waitFor(() => {
		expect(getComputedStyle(trigger).pointerEvents).not.toBe('none');
	});
};

const meta = {
	title: 'Components/Structured Value/Viewer',
	component: StructuredValueViewer,
	render: (args) => ({
		Component: StructuredValueViewer,
		props: args,
	}),
} satisfies Meta<typeof StructuredValueViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MenuSwitchesTheReadOnlyCodeMirrorDocument = {
	name: 'Scenario: Given a structured payload When the viewer mode changes from YAML to plain text Then the shadcn dropdown and read-only CodeMirror surface stay in sync',
	args: {
		value: {
			status: 'ok',
			count: 2,
			nested: {
				kind: 'assistant',
			},
		},
		rawText,
	},
	play: async ({ canvasElement }) => {
		setGlobalJsonViewerMode(DEFAULT_JSON_VIEWER_MODE);
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Structured value options' });

		await expect(canvasElement.textContent).toContain('status: ok');

		await userEvent.click(trigger);

		const overlay = within(document.body);
		const [localPlainTextOption] = overlay.getAllByRole('menuitemradio', { name: /Plain text/u });
		await userEvent.click(localPlainTextOption!);

		await expect(trigger).toHaveTextContent('Plain text');
		await expect(canvasElement.textContent).toContain(rawText);
	},
} satisfies Story;

export const GlobalModeImmediatelyUpdatesNonOverriddenViewer = {
	name: 'Scenario: Given a viewer without a local override When All viewers changes Then the mounted viewer immediately tracks the global mode',
	args: {
		value: {
			status: 'ok',
			count: 2,
			nested: {
				kind: 'assistant',
			},
		},
		rawText,
	},
	play: async ({ canvasElement }) => {
		setGlobalJsonViewerMode(DEFAULT_JSON_VIEWER_MODE);
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Structured value options' });
		const viewer = canvas.getByTestId('structured-value-viewer') as HTMLDivElement;

		await expect(trigger).toHaveTextContent('YAML preview');
		expect(viewer.dataset.jsonViewerMode).toBe('highlight-yaml');
		expect(viewer.dataset.jsonViewerLocalMode).toBeUndefined();

		await waitForInteractiveTrigger(trigger);
		await userEvent.click(trigger);

		const overlay = within(document.body);
		const globalPlainTextOption = overlay.getAllByRole('menuitemradio', {
			name: /Plain text/u,
		})[1];
		await userEvent.click(globalPlainTextOption!);

		await expect(trigger).toHaveTextContent('Plain text');
		expect(viewer.dataset.jsonViewerMode).toBe('raw-text-json');
		expect(viewer.dataset.jsonViewerGlobalMode).toBe('raw-text-json');
		expect(viewer.dataset.jsonViewerLocalMode).toBeUndefined();
		await expect(canvasElement.textContent).toContain(rawText);
	},
} satisfies Story;

export const LocalOverrideStaysDomLocalUntilRemount = {
	name: 'Scenario: Given one viewer has a local override When the global mode changes and that DOM instance remounts Then only the remount drops back to the global mode',
	render: (args) => ({
		Component: StructuredValueViewerStoryHarness,
		props: args,
	}),
	args: {
		value: {
			status: 'ok',
			count: 2,
			nested: {
				kind: 'assistant',
			},
		},
		rawText,
	},
	play: async ({ canvasElement }) => {
		setGlobalJsonViewerMode(DEFAULT_JSON_VIEWER_MODE);
		const canvas = within(canvasElement);
		const primary = canvas.getByTestId('structured-value-viewer-primary');
		const secondary = canvas.getByTestId('structured-value-viewer-secondary');
		const primaryTrigger = within(primary).getByRole('button', {
			name: 'Primary structured value options',
		});
		const secondaryTrigger = within(secondary).getByRole('button', {
			name: 'Secondary structured value options',
		});
		const primaryViewer = within(primary).getByTestId('structured-value-viewer') as HTMLDivElement;
		let secondaryViewer = within(secondary).getByTestId('structured-value-viewer') as HTMLDivElement;

		await waitForInteractiveTrigger(secondaryTrigger);
		await userEvent.click(secondaryTrigger);
		let overlay = within(document.body);
		const localFormattedJsonOption = overlay.getAllByRole('menuitemradio', {
			name: /Formatted JSON/u,
		})[0];
		await userEvent.click(localFormattedJsonOption!);

		await expect(secondaryTrigger).toHaveTextContent('Formatted JSON');
		expect(secondaryViewer.dataset.jsonViewerMode).toBe('fmt-highlight-json');
		expect(secondaryViewer.dataset.jsonViewerLocalMode).toBe('fmt-highlight-json');

		await waitForInteractiveTrigger(primaryTrigger);
		await userEvent.click(primaryTrigger);
		overlay = within(document.body);
		const globalPlainTextOption = overlay.getAllByRole('menuitemradio', {
			name: /Plain text/u,
		})[1];
		await userEvent.click(globalPlainTextOption!);

		await expect(primaryTrigger).toHaveTextContent('Plain text');
		await expect(secondaryTrigger).toHaveTextContent('Formatted JSON');
		expect(primaryViewer.dataset.jsonViewerMode).toBe('raw-text-json');
		expect(primaryViewer.dataset.jsonViewerLocalMode).toBeUndefined();
		expect(secondaryViewer.dataset.jsonViewerMode).toBe('fmt-highlight-json');
		expect(secondaryViewer.dataset.jsonViewerGlobalMode).toBe('raw-text-json');

		const remountButton = canvas.getByRole('button', { name: 'Remount secondary viewer' });
		await waitForInteractiveTrigger(remountButton);
		await userEvent.click(remountButton);

		await waitFor(() => {
			const remountedSecondary = canvas.getByTestId('structured-value-viewer-secondary');
			secondaryViewer = within(remountedSecondary).getByTestId(
				'structured-value-viewer',
			) as HTMLDivElement;
			expect(secondaryViewer.dataset.jsonViewerMode).toBe('raw-text-json');
			expect(secondaryViewer.dataset.jsonViewerGlobalMode).toBe('raw-text-json');
			expect(secondaryViewer.dataset.jsonViewerLocalMode).toBeUndefined();
		});
	},
} satisfies Story;
