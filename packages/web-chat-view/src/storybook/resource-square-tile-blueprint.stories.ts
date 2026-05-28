import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, within } from "storybook/test";

import Harness from "./resource-square-tile-blueprint-harness.svelte";

const meta = {
  title: "WebChatView/Blueprints/ResourceSquareTile",
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

export const States = {
  args: {
    width: 720,
    height: 520,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Core Variants")).toBeInTheDocument();
    await expect(canvas.getByText("Pending")).toBeInTheDocument();
    await expect(canvas.getByText("Rail")).toBeInTheDocument();
    await expect(canvas.getAllByRole("button").length).toBeGreaterThanOrEqual(9);
  },
} satisfies Story;
