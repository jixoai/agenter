import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, within } from "storybook/test";

import Harness from "./message-source-popup-harness.svelte";

const meta = {
  title: "WebChatView/Composites/MessageSourcePopup",
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

export const CompactSource = {
  args: {
    width: 390,
    height: 844,
    open: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole("dialog", { name: "Source for Kai" });
    await expect(dialog).toBeInTheDocument();
    await expect(within(dialog).getByText("Kai")).toBeInTheDocument();
    await expect(within(dialog).getByLabelText("Copy source")).toBeInTheDocument();
    await expect(within(dialog).getByText("# Review checklist")).toBeInTheDocument();
    await expect(within(dialog).getByText("[^Image 1]: [!source-image-name](https://assets.example/image.jpg)")).toBeInTheDocument();
    await expect(within(dialog).getByText("[^File 2]: [!resource-map.pdf](https://assets.example/resource-map.pdf)")).toBeInTheDocument();
    await expect(
      within(dialog).getByText(
        "[^Comment 1]: [Expose comment detail in view mode by default.](msg://room-1/12#L3)",
      ),
    ).toBeInTheDocument();
    await expect(within(dialog).getByText("May 3, 5:12 PM")).toBeInTheDocument();
    await expect(dialog.querySelector('[data-active-line="true"]')?.getAttribute("data-line-number")).toBe("3");
  },
} satisfies Story;
