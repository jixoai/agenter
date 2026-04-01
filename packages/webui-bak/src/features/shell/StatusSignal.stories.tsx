import { Bot, WifiOff } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { StatusSignal } from "./StatusSignal";

const meta = {
  title: "Features/Shell/StatusSignal",
  component: StatusSignal,
  args: {
    label: "AI ready",
    icon: Bot,
    tone: "muted",
  },
  render: (args) => (
    <div className="bg-white p-6">
      <StatusSignal {...args} />
    </div>
  ),
} satisfies Meta<typeof StatusSignal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReadySignalKeepsTooltipAndAria: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const signal = canvas.getByLabelText("AI ready");

    await userEvent.hover(signal);
    await waitFor(() => {
      expect(portal.getByText("AI ready")).toBeInTheDocument();
    });
  },
};

export const OfflineSignalKeepsDangerTone: Story = {
  args: {
    label: "Offline",
    icon: WifiOff,
    tone: "danger",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Offline")).toBeInTheDocument();
  },
};
