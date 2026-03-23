import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { ComposerStatusBar } from "./ComposerStatusBar";

const meta = {
  title: "Features/Chat/ComposerStatusBar",
  component: ComposerStatusBar,
  args: {
    disabled: false,
    submitting: false,
    imageEnabled: true,
    screenshotSupported: true,
  },
} satisfies Meta<typeof ComposerStatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WideStatusBarKeepsInlineHelp: Story = {
  render: (args) => (
    <div className="w-[720px] bg-white p-6">
      <ComposerStatusBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statusBar = canvas.getByTestId("composer-status-bar");

    await expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Attachments ready");
    await expect(within(statusBar).getByText("path")).toBeInTheDocument();
    await expect(within(statusBar).getByText("newline")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Composer help" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(statusBar.getBoundingClientRect().height).toBeLessThan(36);
    });
  },
};

export const CompactStatusBarCollapsesHelpIntoMenu: Story = {
  render: (args) => (
    <div className="w-[375px] bg-white p-4">
      <ComposerStatusBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await waitFor(() => {
      expect(canvas.queryByText("path")).not.toBeInTheDocument();
      const helpTrigger = canvas.getByRole("button", { name: "Composer help" });
      expect(helpTrigger).toHaveTextContent("?");
      expect(helpTrigger.querySelector("svg")).toBeNull();
      expect(canvas.getByTestId("composer-status-bar").getBoundingClientRect().height).toBeLessThan(36);
    });

    await userEvent.click(canvas.getByRole("button", { name: "Composer help" }));
    await waitFor(() => {
      expect(portal.getByText("Composer help")).toBeInTheDocument();
      expect(portal.getByText("path")).toBeInTheDocument();
      expect(portal.getByText("files")).toBeInTheDocument();
    });
  },
};

export const SubmittingStatusBarShowsBusySignal: Story = {
  args: {
    submitting: true,
  },
  render: (args) => (
    <div className="w-[520px] bg-white p-4">
      <ComposerStatusBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Sending");
  },
};
