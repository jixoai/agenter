import { Paperclip } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { AdaptiveIconButton } from "./adaptive-icon-button";

const meta = {
  title: "Components/UI/AdaptiveIconButton",
  component: AdaptiveIconButton,
  args: {
    icon: Paperclip,
    label: "Attach",
    tooltip: "Attach files, images, or videos",
    variant: "outline",
    size: "sm",
    onClick: () => undefined,
  },
} satisfies Meta<typeof AdaptiveIconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WideButtonKeepsLabel: Story = {
  render: (args) => (
    <div className="w-[220px] bg-white p-6">
      <AdaptiveIconButton {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const button = canvas.getByRole("button", { name: "Attach" });

    await expect(within(button).getByText("Attach")).toBeInTheDocument();

    await userEvent.hover(button);
    await waitFor(() => {
      expect(portal.getByText("Attach files, images, or videos")).toBeInTheDocument();
    });
  },
};

export const CompactButtonCollapsesToIconOnly: Story = {
  render: (args) => (
    <div className="w-[72px] bg-white p-4">
      <AdaptiveIconButton {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const button = canvas.getByRole("button", { name: "Attach" });

    await waitFor(() => {
      expect(within(button).queryByText("Attach")).not.toBeInTheDocument();
    });

    await userEvent.hover(button);
    await waitFor(() => {
      expect(portal.getByText("Attach files, images, or videos")).toBeInTheDocument();
    });
  },
};
