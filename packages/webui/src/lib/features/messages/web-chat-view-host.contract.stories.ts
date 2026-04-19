import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import Harness from './web-chat-view-host.story-harness.svelte';
import { containsVisibleTextDeep } from '$lib/testing/shadow-dom';

type HarnessState = {
	loadedMessageCount: number;
	transportAppendCount: number;
	pageRequestCount: number;
	pendingOlderCount: number;
	latestVisibleMessage: { messageId: string; rowId: number } | null;
	clientPayloadTypes: string[];
	viewport: {
		scrollTop: number;
		scrollHeight: number;
		clientHeight: number;
		atLatest: string | null;
		atStart: string | null;
		latestAffordanceVisible: string | null;
	} | null;
};

const readHarnessState = (canvas: ReturnType<typeof within>): HarnessState =>
	JSON.parse(canvas.getByTestId('web-chat-story-state').textContent ?? '{}') as HarnessState;

const readLatestAffordance = (canvas: ReturnType<typeof within>): string | null =>
	canvas.getByTestId('web-chat-story-root').getAttribute('data-debug-latest-affordance');

const waitForInitialTransport = async (
	canvas: ReturnType<typeof within>,
	canvasElement: HTMLElement,
	options: {
		pendingOlderCount: number;
		latestMessageId: string;
	},
): Promise<HarnessState> => {
	let snapshot = readHarnessState(canvas);
	await waitFor(() => {
		snapshot = readHarnessState(canvas);
		expect(canvasElement.querySelector("[data-testid='web-chat-scroll-viewport']")).not.toBeNull();
		expect(snapshot.loadedMessageCount).toBe(28);
		expect(snapshot.pendingOlderCount).toBe(options.pendingOlderCount);
		expect(snapshot.latestVisibleMessage?.messageId).toBe(options.latestMessageId);
	});
	return snapshot;
};

const getViewport = (canvasElement: HTMLElement): HTMLDivElement => {
	const viewport = canvasElement.querySelector<HTMLDivElement>("[data-testid='web-chat-scroll-viewport']");
	expect(viewport).not.toBeNull();
	return viewport!;
};

const waitForAnimationFrame = async (): Promise<void> => {
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve());
	});
};

const meta = {
	title: 'Features/Messages/WebChatViewHost/Contracts',
	component: Harness,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Consumer-level Storybook contracts for the shared bottom-anchored chat transcript. These scenarios validate latest affordance, away-from-latest preservation, and older-page loading on the real host surface.',
			},
		},
	},
	render: (args) => ({
		Component: Harness,
		props: args,
	}),
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TransportAppendWhilePinnedKeepsLatestVisible = {
	args: {
		olderPageCount: 0,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitForInitialTransport(canvas, canvasElement, {
			pendingOlderCount: 0,
			latestMessageId: 'msg-28',
		});
		expect(readHarnessState(canvas).viewport?.latestAffordanceVisible).toBe('false');

		await userEvent.click(canvas.getByTestId('web-chat-story-push-latest'));

		await waitFor(() => {
			const state = readHarnessState(canvas);
			expect(state.transportAppendCount).toBe(1);
			expect(state.loadedMessageCount).toBe(29);
			expect(state.latestVisibleMessage?.messageId).toBe('msg-29');
			expect(state.viewport?.latestAffordanceVisible).toBe('false');
			expect(containsVisibleTextDeep(canvasElement, 'Transport append #1')).toBe(true);
		});

		const latestRow = canvasElement.querySelector<HTMLElement>("[data-message-id='msg-29']");
		expect(latestRow?.dataset.insertMotion).toBe('latest');
	},
} satisfies Story;

export const TransportAppendWhileAwayKeepsAffordanceVisible = {
	args: {
		olderPageCount: 0,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitForInitialTransport(canvas, canvasElement, {
			pendingOlderCount: 0,
			latestMessageId: 'msg-28',
		});
		await userEvent.click(canvas.getByTestId('web-chat-story-scroll-away'));

		await waitFor(
			() => {
				expect(readLatestAffordance(canvas)).toBe('true');
			},
			{ timeout: 3_000 },
		);

		await userEvent.click(canvas.getByTestId('web-chat-story-push-latest'));

		await waitFor(() => {
			const state = readHarnessState(canvas);
			expect(state.transportAppendCount).toBe(1);
			expect(state.loadedMessageCount).toBe(29);
			expect(state.latestVisibleMessage?.messageId).not.toBe('msg-29');
			expect(readLatestAffordance(canvas)).toBe('true');
		});

		await userEvent.click(canvas.getByRole('button', { name: 'Scroll to latest' }));

		await waitFor(() => {
			const state = readHarnessState(canvas);
			expect(state.latestVisibleMessage?.messageId).toBe('msg-29');
			expect(readLatestAffordance(canvas)).toBe('false');
			expect(containsVisibleTextDeep(canvasElement, 'Transport append #1')).toBe(true);
		});
	},
} satisfies Story;

export const ReachingHistoryStartLoadsOlderPage = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitForInitialTransport(canvas, canvasElement, {
			pendingOlderCount: 6,
			latestMessageId: 'msg-34',
		});
		await userEvent.click(canvas.getByTestId('web-chat-story-reach-start'));

		await waitFor(() => {
			const state = readHarnessState(canvas);
			expect(state.pageRequestCount).toBe(1);
			expect(state.loadedMessageCount).toBe(34);
			expect(state.pendingOlderCount).toBe(0);
			expect(containsVisibleTextDeep(canvasElement, 'Older history #1')).toBe(true);
		});

		const olderRow = canvasElement.querySelector<HTMLElement>("[data-message-id='msg-1']");
		expect(olderRow?.dataset.insertMotion).toBe('older');
	},
} satisfies Story;

export const ScrollToLatestInterruptedByWheelKeepsTranscriptAway = {
	args: {
		olderPageCount: 0,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitForInitialTransport(canvas, canvasElement, {
			pendingOlderCount: 0,
			latestMessageId: 'msg-28',
		});
		const viewport = getViewport(canvasElement);
		await userEvent.click(canvas.getByTestId('web-chat-story-scroll-away'));

		let awayState = readHarnessState(canvas);
		await waitFor(
			() => {
				awayState = readHarnessState(canvas);
				expect(readLatestAffordance(canvas)).toBe('true');
				expect(awayState.latestVisibleMessage?.messageId).not.toBe('msg-28');
			},
			{ timeout: 3_000 },
		);

		await userEvent.click(canvas.getByRole('button', { name: 'Scroll to latest' }));
		await waitForAnimationFrame();

		viewport.dispatchEvent(new Event('wheel'));
		await userEvent.click(canvas.getByTestId('web-chat-story-scroll-away'));

		await waitFor(() => {
			const state = readHarnessState(canvas);
			expect(readLatestAffordance(canvas)).toBe('true');
			expect(state.latestVisibleMessage?.messageId).not.toBe('msg-28');
		});
	},
} satisfies Story;
