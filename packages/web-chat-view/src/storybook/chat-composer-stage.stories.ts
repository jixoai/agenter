import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, within } from "storybook/test";

import Harness from "./chat-composer-stage-harness.svelte";

const meta = {
  title: "WebChatView/Composites/ChatComposerStage",
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

export const CompactComposer = {
  args: {
    width: 390,
    height: 300,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Transcript stage")).toBeInTheDocument();
    await expect(canvas.getByRole("group", { name: "Message composer" })).toBeInTheDocument();
    await expect(canvas.getByTitle("Attach files")).toBeInTheDocument();
    await expect(canvas.getByTitle("Capture screenshot")).toBeInTheDocument();
    await expect(canvas.getByTitle("Send message")).toBeInTheDocument();
    await expect(canvas.getByText("@")).toBeInTheDocument();
    await expect(canvas.getByText("^")).toBeInTheDocument();
  },
} satisfies Story;
