import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, waitFor } from 'storybook/test';

import SkillPreviewPane from './skill-preview-pane.svelte';

const meta = {
	title: 'Features/Skills/Skill Preview Pane',
	component: SkillPreviewPane,
	render: (args) => ({
		Component: SkillPreviewPane,
		props: args,
	}),
} satisfies Meta<typeof SkillPreviewPane>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TextPreviewUsesFilePreviewer = {
	name: 'Scenario: Given a text preview payload When the pane renders Then filePreviewer receives the routed iframe contract',
	args: {
		preview: {
			path: '/SKILL.md',
			name: 'SKILL.md',
			kind: 'file',
			sizeBytes: 128,
			modifiedAtMs: 2,
			previewKind: 'text',
			mimeType: 'text/markdown',
			textContent: '# Reviewer\n\nRead-only preview body for this skill file.\n',
			mediaDataUrl: null,
			truncated: false,
			note: null,
		},
	},
	play: async () => {
		await waitFor(() => {
			const previewFrame = document.querySelector<HTMLIFrameElement>('iframe[title="SKILL.md preview"]');
			expect(previewFrame).toBeTruthy();
			expect(previewFrame?.getAttribute('src')).toContain('/filePreviewer.html?previewKey=');
		});
	},
} satisfies Story;
