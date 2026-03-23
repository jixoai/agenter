import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { AIInputToolbar } from "./AIInputToolbar";

type AIInputToolbarStoryArgs = {
  disabled: boolean;
  submitting: boolean;
  canSubmit: boolean;
  imageEnabled: boolean;
  screenshotSupported: boolean;
  submitLabel: string;
  submitTitle?: string;
  onFileInputChange: (files: FileList | null) => void;
  onCaptureScreenshot: () => void;
  onSubmit: () => void;
};

const renderToolbar = (widthClassName: string) => (args: AIInputToolbarStoryArgs) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className={`bg-white p-6 ${widthClassName}`}>
      <AIInputToolbar {...args} fileInputRef={fileInputRef} />
    </div>
  );
};

const meta: Meta<AIInputToolbarStoryArgs> = {
  title: "Features/Chat/AIInputToolbar",
  args: {
    disabled: false,
    submitting: false,
    canSubmit: true,
    imageEnabled: true,
    screenshotSupported: true,
    submitLabel: "Send",
    onFileInputChange: fn(),
    onCaptureScreenshot: fn(),
    onSubmit: fn(),
  },
};

export default meta;

type Story = StoryObj<AIInputToolbarStoryArgs>;

export const WideToolbarKeepsLabelsAndHints: Story = {
  args: {},
  render: renderToolbar("w-[720px]"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actionBar = canvas.getByTestId("composer-action-bar");
    const leadingGroup = canvas.getByTestId("composer-action-leading");
    const primaryAction = canvas.getByTestId("composer-action-primary");
    const statusBar = canvas.getByTestId("composer-status-bar");
    const attachButton = canvas.getByRole("button", { name: "Attach" });
    const screenshotButton = canvas.getByRole("button", { name: "Screenshot" });
    const sendButton = canvas.getByRole("button", { name: "Send" });

    await waitFor(() => {
      const actionRect = actionBar.getBoundingClientRect();
      const statusRect = statusBar.getBoundingClientRect();
      const attachRect = attachButton.getBoundingClientRect();
      const screenshotRect = screenshotButton.getBoundingClientRect();
      const sendRect = sendButton.getBoundingClientRect();
      expect(actionRect.height).toBeGreaterThan(statusRect.height);
      expect(Math.abs(attachRect.top - screenshotRect.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(sendRect.top - screenshotRect.top)).toBeLessThanOrEqual(2);
      expect(screenshotRect.left - attachRect.right).toBeLessThanOrEqual(12);
      expect(primaryAction.getBoundingClientRect().left).toBeGreaterThan(
        leadingGroup.getBoundingClientRect().right - 8,
      );
    });

    await expect(within(attachButton).getByText("Attach")).toBeInTheDocument();
    await expect(within(screenshotButton).getByText("Screenshot")).toBeInTheDocument();
    await expect(within(statusBar).getByText("Attachments ready")).toBeInTheDocument();
    await expect(within(statusBar).getByText("path")).toBeInTheDocument();
    await expect(within(statusBar).getByText("newline")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Composer help" })).not.toBeInTheDocument();
    await expect(statusBar.getBoundingClientRect().height).toBeLessThan(36);
  },
};

export const CompactToolbarCollapsesHelpAndSecondaryLabels: Story = {
  args: {},
  render: renderToolbar("w-[320px]"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const actionBar = canvas.getByTestId("composer-action-bar");
    const leadingGroup = canvas.getByTestId("composer-action-leading");
    const primaryAction = canvas.getByTestId("composer-action-primary");
    const statusBar = canvas.getByTestId("composer-status-bar");
    const attachButton = canvas.getByRole("button", { name: "Attach" });
    const screenshotButton = canvas.getByRole("button", { name: "Screenshot" });

    await waitFor(() => {
      expect(within(attachButton).queryByText("Attach")).not.toBeInTheDocument();
      expect(within(screenshotButton).queryByText("Screenshot")).not.toBeInTheDocument();
      expect(actionBar.getBoundingClientRect().height).toBeGreaterThan(statusBar.getBoundingClientRect().height);
    });

    await expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Attachments ready");
    await expect(
      canvas.queryAllByText("path").some((node) => node instanceof HTMLElement && node.offsetParent !== null),
    ).toBe(false);
    const helpTrigger = canvas.getByRole("button", { name: "Composer help" });
    await expect(helpTrigger).toHaveTextContent("?");
    await expect(helpTrigger.querySelector("svg")).toBeNull();
    await expect(canvas.getByRole("button", { name: "Send" })).toBeInTheDocument();
    await waitFor(() => {
      const attachRect = attachButton.getBoundingClientRect();
      const screenshotRect = screenshotButton.getBoundingClientRect();
      expect(attachRect.width).toBeLessThanOrEqual(64);
      expect(screenshotRect.width).toBeLessThanOrEqual(72);
      expect(screenshotRect.left - attachRect.right).toBeLessThanOrEqual(12);
      expect(primaryAction.getBoundingClientRect().left).toBeGreaterThan(
        leadingGroup.getBoundingClientRect().right - 8,
      );
    });

    await userEvent.click(helpTrigger);

    const hasVisibleText = (text: string) =>
      portal.getAllByText(text).some((node) => node instanceof HTMLElement && node.offsetParent !== null);

    await waitFor(() => {
      expect(hasVisibleText("path")).toBe(true);
      expect(hasVisibleText("send")).toBe(true);
      expect(hasVisibleText("files")).toBe(true);
    });
  },
};
