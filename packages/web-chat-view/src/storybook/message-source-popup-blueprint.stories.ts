import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, within } from "storybook/test";

import Harness from "./message-source-popup-blueprint-harness.svelte";

const meta = {
  title: "WebChatView/Blueprints/MessageSourcePopup",
  component: Harness,
  parameters: {
    layout: "fullscreen",
  },
  render: (args) => ({
    Component: Harness,
    props: args,
  }),
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PreviewLayer = {
  args: {
    width: 390,
    height: 844,
    open: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const dialog = canvas.getByRole("dialog", { name: "Comment 1" });
    const anchorCard = within(dialog).getByLabelText("Selected text comment anchor");
    await expect(dialog).toBeInTheDocument();
    await expect(within(anchorCard).getByText("Selected text")).toBeInTheDocument();
    await expect(within(dialog).getByText("这里是一个评论资源预览状态")).toBeInTheDocument();
    await expect(within(dialog).getByRole("tab", { name: /View/i })).toHaveAttribute("aria-selected", "true");
    await expect(within(anchorCard).getByText("Kai · Line 3")).toBeInTheDocument();
  },
} satisfies Story;
