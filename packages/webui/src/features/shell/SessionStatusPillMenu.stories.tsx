import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { SessionStatusPillMenu } from "./SessionStatusPillMenu";

const meta = {
  title: "Features/Shell/SessionStatusPillMenu",
  component: SessionStatusPillMenu,
  args: {
    statusLabel: "Session running",
    tone: "active",
    primaryActionLabel: "Stop session",
    onPrimaryAction: fn(),
    onAbort: fn(),
  },
  render: (args) => (
    <div className="bg-white p-6">
      <SessionStatusPillMenu {...args} />
    </div>
  ),
} satisfies Meta<typeof SessionStatusPillMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RunningMenuStopsOrAborts: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Session status: Session running" }));
    await userEvent.click(await portal.findByRole("menuitem", { name: "Stop session" }));

    await userEvent.click(canvas.getByRole("button", { name: "Session status: Session running" }));
    await userEvent.click(await portal.findByRole("menuitem", { name: "Abort session" }));

    await expect(args.onPrimaryAction).toHaveBeenCalledTimes(1);
    await expect(args.onAbort).toHaveBeenCalledTimes(1);
  },
};

export const PausedMenuResumesSession: Story = {
  args: {
    statusLabel: "Session paused",
    tone: "warning",
    primaryActionLabel: "Resume session",
    onPrimaryAction: fn(),
    onAbort: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Session status: Session paused" }));
    await userEvent.click(await portal.findByRole("menuitem", { name: "Resume session" }));

    await expect(args.onPrimaryAction).toHaveBeenCalledTimes(1);
  },
};

export const PendingMenuDisablesActions: Story = {
  args: {
    primaryActionPending: true,
    abortPending: true,
    onPrimaryAction: fn(),
    onAbort: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Session status: Session running" }));
    const stopItem = await portal.findByRole("menuitem", { name: "Stop session" });
    const abortItem = await portal.findByRole("menuitem", { name: "Abort session" });

    await waitFor(() => {
      expect(stopItem).toHaveAttribute("aria-disabled", "true");
      expect(abortItem).toHaveAttribute("aria-disabled", "true");
    });

    await expect(args.onPrimaryAction).not.toHaveBeenCalled();
    await expect(args.onAbort).not.toHaveBeenCalled();
  },
};

export const CompactIconMenuKeepsStatusInHeader: Story = {
  args: {
    triggerVariant: "icon",
    statusLabel: "Session stopped",
    tone: "neutral",
    primaryActionLabel: "Start session",
    onPrimaryAction: fn(),
    onAbort: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const trigger = canvas.getByRole("button", { name: "Session status: Session stopped" });
    const icon = trigger.querySelector("svg");

    await waitFor(() => {
      expect(icon).not.toBeNull();
      const rect = icon?.getBoundingClientRect();
      expect(rect?.width ?? 0).toBeGreaterThanOrEqual(15);
      expect(rect?.height ?? 0).toBeGreaterThanOrEqual(15);
    });

    await userEvent.click(trigger);
    await userEvent.click(await portal.findByRole("menuitem", { name: "Start session" }));

    await expect(args.onPrimaryAction).toHaveBeenCalledTimes(1);
  },
};
