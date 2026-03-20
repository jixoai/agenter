import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { AppHeader } from "./AppHeader";

const meta = {
  title: "Features/Shell/AppHeader",
  component: AppHeader,
  args: {
    locationLabel: "Chat",
    showNavigationTrigger: false,
    connectionStatus: "connected",
    aiStatus: "working",
    onOpenNavigation: fn(),
  },
  render: (args) => (
    <div className="p-6">
      <AppHeader {...args} />
    </div>
  ),
} satisfies Meta<typeof AppHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PassiveDesktopHeader: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("agenter")).toBeInTheDocument();
    await expect(canvas.getByText("Chat")).toBeInTheDocument();
    await expect(canvas.getByText("Connected")).toBeInTheDocument();
    await expect(canvas.getByText("AI working")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Open global settings" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Start session" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Stop session" })).not.toBeInTheDocument();
  },
};

export const CompactHeaderKeepsOnlyNavigationTrigger: Story = {
  args: {
    showNavigationTrigger: true,
    aiStatus: null,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Open global settings" })).not.toBeInTheDocument();
    await expect(canvas.queryByText(/AI /)).not.toBeInTheDocument();
    await expect(args.onOpenNavigation).not.toHaveBeenCalled();
    await expect(canvas.queryByRole("button", { name: "Chat" })).not.toBeInTheDocument();
  },
};

export const OfflineHeaderShowsTransportState: Story = {
  args: {
    connectionStatus: "offline",
    aiStatus: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Offline")).toBeInTheDocument();
  },
};

export const ReconnectingHeaderShowsTransportState: Story = {
  args: {
    connectionStatus: "reconnecting",
    aiStatus: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Reconnecting")).toBeInTheDocument();
  },
};
