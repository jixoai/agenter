import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { __clearHelpHintPersistenceForTests } from "../../components/ui/help-hint-store";
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

export const WideStatusBarAutoOpensHelpHint: Story = {
  render: (args) => (
    <div className="w-[720px] bg-white p-6">
      <ComposerStatusBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await __clearHelpHintPersistenceForTests();
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const statusBar = canvas.getByTestId("composer-status-bar");
    const helpTrigger = canvas.getByRole("button", { name: "Composer help" });

    await expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Attachments ready");
    await expect(helpTrigger).toHaveTextContent("?");
    await waitFor(async () => {
      await expect(portal.getByText("Composer help")).toBeVisible();
      await expect(portal.getByText("path")).toBeVisible();
      await expect(portal.getByText("newline")).toBeVisible();
    });

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
    await __clearHelpHintPersistenceForTests();
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await waitFor(() => {
      const helpTrigger = canvas.getByRole("button", { name: "Composer help" });
      expect(helpTrigger).toHaveTextContent("?");
      expect(helpTrigger.querySelector("svg")).toBeNull();
      expect(canvas.getByTestId("composer-status-bar").getBoundingClientRect().height).toBeLessThan(36);
    });

    await waitFor(() => {
      expect(portal.getByText("Composer help")).toBeInTheDocument();
      expect(portal.getByText("path")).toBeInTheDocument();
      expect(portal.getByText("files")).toBeInTheDocument();
    });

    const helpTrigger = canvas.getByRole("button", { name: "Composer help" });
    await userEvent.click(helpTrigger);
    await waitFor(() => {
      expect(helpTrigger).not.toHaveAttribute("data-popup-open");
    });

    await userEvent.click(helpTrigger);
    await waitFor(() => {
      expect(helpTrigger).toHaveAttribute("data-popup-open");
      expect(portal.getByText("Composer help")).toBeInTheDocument();
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
