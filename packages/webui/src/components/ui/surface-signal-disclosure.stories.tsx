import { Info, TriangleAlert } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { SurfaceSignalDisclosure } from "./surface-signal-disclosure";

const meta = {
  title: "Components/UI/SurfaceSignalDisclosure",
  component: SurfaceSignalDisclosure,
  args: {
    label: "Open channel details",
    title: "Channel details",
    description: "Secondary metadata stays behind a compact signal.",
    icon: Info,
    tone: "neutral",
    children: (
      <div className="space-y-2 text-sm">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">chat-jane</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">owner: jane</div>
      </div>
    ),
  },
} satisfies Meta<typeof SurfaceSignalDisclosure>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NeutralSignalOpensDialog: Story = {
  render: (args) => (
    <div className="bg-white p-6">
      <SurfaceSignalDisclosure {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const trigger = canvas.getByRole("button", { name: "Open channel details" });

    await userEvent.hover(trigger);
    await waitFor(() => {
      expect(portal.getByText("Open channel details")).toBeInTheDocument();
    });

    await userEvent.click(trigger);
    await expect(await portal.findByText("Channel details")).toBeInTheDocument();
    await expect(portal.getByText("chat-jane")).toBeInTheDocument();
  },
};

export const WarningSignalKeepsCompactChrome: Story = {
  args: {
    tone: "warning",
    icon: TriangleAlert,
    label: "Open offline details",
    title: "Offline channel",
  },
  render: (args) => (
    <div className="w-[390px] bg-slate-100 p-4">
      <div className="flex items-center justify-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0 flex-1 text-sm text-slate-500">Tabs stay primary.</div>
        <SurfaceSignalDisclosure {...args} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open offline details" });

    await waitFor(() => {
      expect(trigger.getBoundingClientRect().width).toBeLessThanOrEqual(40);
      expect(trigger.getBoundingClientRect().height).toBeLessThanOrEqual(40);
    });
  },
};
