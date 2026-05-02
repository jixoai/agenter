import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

import SkillsSkillBrowserStoryHarness from './skills-skill-browser.story-harness.svelte';

const meta = {
	title: 'Features/Skills/Skills Skill Browser',
	component: SkillsSkillBrowserStoryHarness,
	render: (args) => ({
		Component: SkillsSkillBrowserStoryHarness,
		props: args,
	}),
} satisfies Meta<typeof SkillsSkillBrowserStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TextSelectionOpensReadOnlyPreview = {
	name: 'Scenario: Given one expanded skill When a text file is selected Then the shared detail surface resolves the text preview metadata',
	args: {
		previewMode: 'text',
		detailLeftMin: 160,
		detailRightMin: 160,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		canvas.getByRole('button', { name: /reviewer/i }).click();
		await waitFor(() => {
			expect(canvas.getByText('/SKILL.md')).toBeInTheDocument();
		});
		await userEvent.click(canvasElement.querySelector<HTMLElement>('[data-skill-tree-path="/SKILL.md"]')!);
		await expect(screen.getByText('Path: /SKILL.md')).toBeInTheDocument();
		await expect(screen.getByText('Kind: text')).toBeInTheDocument();
		await expect(screen.getByText('MIME: text/markdown')).toBeInTheDocument();
	},
} satisfies Story;

export const MediaSelectionUsesIsolatedPreviewer = {
	name: 'Scenario: Given one expanded skill When an image file is selected Then the detail pane embeds the isolated filePreviewer iframe',
	args: {
		previewMode: 'image',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		canvas.getByRole('button', { name: /reviewer/i }).click();
		await waitFor(() => {
			expect(canvas.getByText('/preview.png')).toBeInTheDocument();
		});
		canvasElement.querySelector<HTMLElement>('[data-skill-tree-path="/preview.png"]')!.click();

		await waitFor(() => {
			expect(screen.getByTitle('preview.png preview')).toBeInTheDocument();
		});
	},
} satisfies Story;

export const CompactSelectionKeepsPreviewReachable = {
	name: 'Scenario: Given a compact skills browser When a text file is selected Then filePreviewer still opens through the compact detail drawer law',
	args: {
		previewMode: 'text',
		frameClass: 'h-[52rem] w-[390px] max-w-full',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		canvas.getByRole('button', { name: /reviewer/i }).click();
		await waitFor(() => {
			expect(canvas.getByText('/SKILL.md')).toBeInTheDocument();
		});
		canvasElement.querySelector<HTMLElement>('[data-skill-tree-path="/SKILL.md"]')!.click();
		await waitFor(() => {
			const openPreviewButton = screen.queryByRole('button', { name: /Open preview/i });
			const inlinePreview = screen.queryByText('Path: /SKILL.md');
			expect(openPreviewButton || inlinePreview).toBeTruthy();
		});
		const openPreviewButton = screen.queryByRole('button', { name: /Open preview/i });
		if (openPreviewButton) {
			await userEvent.click(openPreviewButton);
		}
		await expect(screen.getByText('Path: /SKILL.md')).toBeInTheDocument();
		await waitFor(() => {
			const previewFrame = document.querySelector<HTMLIFrameElement>('iframe[title="SKILL.md preview"]');
			expect(previewFrame).toBeTruthy();
			expect(previewFrame?.className).toContain('skill-preview-frame');
		});
	},
} satisfies Story;
