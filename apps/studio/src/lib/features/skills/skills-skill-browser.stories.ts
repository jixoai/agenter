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

export const SplitDetailResizeShieldsIframePreview = {
	name: 'Scenario: Given split detail contains an iframe When resizing crosses the preview Then drag ownership stays in the parent shell',
	args: {
		previewMode: 'image',
		detailLeftMin: 160,
		detailRightMin: 160,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		canvas.getByRole('button', { name: /reviewer/i }).click();
		await waitFor(() => {
			expect(canvas.getByText('/preview.png')).toBeInTheDocument();
		});
		canvasElement.querySelector<HTMLElement>('[data-skill-tree-path="/preview.png"]')!.click();

		const previewFrame = await waitFor(() => {
			const frame = document.querySelector<HTMLIFrameElement>('iframe[title="preview.png preview"]');
			expect(frame).toBeTruthy();
			return frame!;
		});
		const splitRoot = await waitFor(() => {
			const root = canvasElement.querySelector<HTMLElement>('[data-layout-role="workbench-split-detail-root"]');
			expect(root).toBeTruthy();
			expect(root?.dataset.compact).toBe('false');
			return root!;
		});
		const handle = canvas.getByRole('separator', { name: 'Resize detail panel' });
		const handleRect = handle.getBoundingClientRect();
		const startX = Math.round(handleRect.left + handleRect.width / 2);
		const startY = Math.round(handleRect.top + handleRect.height / 2);

		handle.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				button: 0,
				clientX: startX,
				clientY: startY,
				pointerId: 17,
				pointerType: 'mouse',
			}),
		);

		const dragShield = await waitFor(() => {
			const shield = document.querySelector<HTMLElement>(
				'[data-layout-role="workbench-split-detail-drag-shield"]',
			);
			expect(shield).toBeTruthy();
			return shield!;
		});
		await expect(splitRoot).toHaveAttribute('data-dragging', 'true');
		await expect(dragShield).toHaveAttribute('data-slot', 'workbench-split-detail-drag-shield');
		expect(getComputedStyle(previewFrame).pointerEvents).toBe('none');

		document.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				cancelable: true,
				clientX: startX + 72,
				clientY: startY,
				pointerId: 17,
				pointerType: 'mouse',
			}),
		);
		document.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				clientX: startX + 72,
				clientY: startY,
				pointerId: 17,
				pointerType: 'mouse',
			}),
		);

		await waitFor(() => {
			expect(document.querySelector('[data-layout-role="workbench-split-detail-drag-shield"]')).toBeNull();
			expect(splitRoot).toHaveAttribute('data-dragging', 'false');
		});
		expect(getComputedStyle(previewFrame).pointerEvents).not.toBe('none');
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
