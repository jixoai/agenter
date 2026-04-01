import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { ComposerActionBar } from "./ComposerActionBar";

type ComposerActionBarStoryArgs = {
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

const renderActionBar = (widthClassName: string) => (args: ComposerActionBarStoryArgs) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className={`bg-white p-6 ${widthClassName}`}>
      <ComposerActionBar {...args} fileInputRef={fileInputRef} />
    </div>
  );
};

const meta: Meta<ComposerActionBarStoryArgs> = {
  title: "Features/Chat/ComposerActionBar",
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

type Story = StoryObj<ComposerActionBarStoryArgs>;

export const WideActionBarKeepsLabelsOnOneRow: Story = {
  render: renderActionBar("w-[720px]"),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const actionBar = canvas.getByTestId("composer-action-bar");
    const attachButton = canvas.getByRole("button", { name: "Attach" });
    const screenshotButton = canvas.getByRole("button", { name: "Screenshot" });
    const sendButton = canvas.getByRole("button", { name: "Send" });

    await waitFor(() => {
      const attachRect = attachButton.getBoundingClientRect();
      const screenshotRect = screenshotButton.getBoundingClientRect();
      const sendRect = sendButton.getBoundingClientRect();
      expect(Math.abs(attachRect.top - screenshotRect.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(sendRect.top - screenshotRect.top)).toBeLessThanOrEqual(2);
      expect(actionBar.getBoundingClientRect().height).toBeLessThan(60);
    });

    await expect(within(attachButton).getByText("Attach")).toBeInTheDocument();
    await expect(within(screenshotButton).getByText("Screenshot")).toBeInTheDocument();

    await userEvent.click(screenshotButton);
    await userEvent.click(sendButton);

    await expect(args.onCaptureScreenshot).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

export const CompactActionBarCollapsesSecondaryLabels: Story = {
  render: renderActionBar("w-[320px]"),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const actionBar = canvas.getByTestId("composer-action-bar");
    const attachButton = canvas.getByRole("button", { name: "Attach" });
    const screenshotButton = canvas.getByRole("button", { name: "Screenshot" });
    const sendButton = canvas.getByRole("button", { name: "Send" });

    await waitFor(() => {
      expect(within(attachButton).queryByText("Attach")).not.toBeInTheDocument();
      expect(within(screenshotButton).queryByText("Screenshot")).not.toBeInTheDocument();
      expect(within(sendButton).getByText("Send")).toBeInTheDocument();
      expect(actionBar.getBoundingClientRect().height).toBeLessThan(60);
    });

    await userEvent.click(screenshotButton);
    await userEvent.click(sendButton);

    await expect(args.onCaptureScreenshot).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};
