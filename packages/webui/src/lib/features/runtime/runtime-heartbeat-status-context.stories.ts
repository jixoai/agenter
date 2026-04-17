import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, screen, waitFor, within } from 'storybook/test';

import type { RuntimeHeartbeatContextState } from './runtime-heartbeat-statusbar-state';
import RuntimeHeartbeatStatusContext from './runtime-heartbeat-status-context.svelte';

const availableState = {
	kind: 'available',
	modelCallId: 73,
	status: 'running',
	providerLabel: 'openai · gpt-5.1',
	inputTokens: 48_000,
	outputTokens: 44_000,
	cachedInputTokens: 2_000,
	reasoningTokens: 4_000,
	usedTokens: 96_000,
	maxContextTokens: 128_000,
	progress: 0.75,
	remainingTokens: 32_000,
	estimatedCost: {
		currency: 'USD',
		inputCost: 0.0312,
		outputCost: 0.041,
		totalCost: 0.0722,
		bandLimitTokens: 128_000,
		estimated: true,
	},
} satisfies RuntimeHeartbeatContextState;

const unavailableState = {
	kind: 'unavailable',
	modelCallId: 74,
	status: 'running',
	providerLabel: 'openai · gpt-5.1',
	maxContextTokens: 128_000,
} satisfies RuntimeHeartbeatContextState;

const meta = {
	title: 'Features/Runtime/Heartbeat Status Context',
	component: RuntimeHeartbeatStatusContext,
	render: (args) => ({
		Component: RuntimeHeartbeatStatusContext,
		props: args,
	}),
} satisfies Meta<typeof RuntimeHeartbeatStatusContext>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AvailableContextOpensUsageHoverCard = {
	name: 'Scenario: Given runtime context usage is available When hovering the trigger Then the ai-elements hover card shows usage rows and estimated cost',
	args: {
		state: availableState,
	},
	play: async ({ canvasElement, userEvent }) => {
		const canvas = within(canvasElement);
		const trigger = canvasElement.querySelector<HTMLElement>('[data-slot="button"]');

		expect(trigger).not.toBeNull();
		await expect(canvas.getByText('75%')).toBeInTheDocument();
		await userEvent.hover(trigger!);

		await waitFor(() => {
			expect(screen.getByText('Estimated cost')).toBeInTheDocument();
		});
		await expect(screen.getByText('Input')).toBeInTheDocument();
		await expect(screen.getByText('Output')).toBeInTheDocument();
		await expect(screen.getByText('Reasoning')).toBeInTheDocument();
		await expect(screen.getByText('Cache')).toBeInTheDocument();
		await expect(screen.getByText('$0.0722')).toBeInTheDocument();
	},
} satisfies Story;

export const UnavailableContextStaysDisabled = {
	name: 'Scenario: Given runtime context usage is unavailable When rendering the status bar Then the trigger stays disabled without mounting hover card content',
	args: {
		state: unavailableState,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button');

		await expect(trigger).toBeDisabled();
		await expect(canvas.getByText('0%')).toBeInTheDocument();
		expect(screen.queryByText('Estimated cost')).toBeNull();
	},
} satisfies Story;
