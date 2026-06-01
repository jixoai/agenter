import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, within } from "storybook/test";

import Harness from "./heartbeat-view-harness.svelte";

const meta = {
  title: "WebHeartbeatView/HeartbeatView",
  component: Harness,
  parameters: {
    layout: "centered",
    viewport: {
      defaultViewport: "iphone14",
    },
  },
  render: (args) => ({
    Component: Harness,
    props: args,
  }),
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReadonlyMobile = {
  args: {
    width: 390,
    height: 844,
    mode: "readonly",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("heartbeat-view")).toHaveAttribute("data-mode", "readonly");
    await expect(canvas.getByText("Call #7")).toBeInTheDocument();
    await expect(canvas.getByText("shell.exec")).toBeInTheDocument();
    await expect(canvas.queryByTitle("Request compact")).not.toBeInTheDocument();
    await expect(canvas.queryByTitle("Configure next call")).not.toBeInTheDocument();
  },
} satisfies Story;

export const ConfigableMobile = {
  args: {
    width: 390,
    height: 844,
    mode: "configable",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("heartbeat-view")).toHaveAttribute("data-mode", "configable");
    await expect(canvas.getByTitle("Request compact")).toBeInTheDocument();
    await expect(canvas.getByTitle("Configure next call")).toBeInTheDocument();
  },
} satisfies Story;
