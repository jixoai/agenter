import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, within } from "storybook/test";

import Harness from "./comment-anchor-badge-harness.svelte";

const meta = {
  title: "WebChatView/Composites/CommentAnchorBadge",
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

export const ViewMode = {
  args: {
    width: 390,
    height: 844,
    mode: "view",
  },
  play: async ({ canvasElement }) => {
    const anchor = canvasElement.querySelector<HTMLElement>('[part="comment-anchor-badge"]');
    await expect(anchor).toBeInTheDocument();
    if (!anchor) {
      throw new Error("comment anchor badge not found");
    }
    await expect(within(anchor).getByRole("button", { name: "Comment 1 comment anchor" })).toBeInTheDocument();
    await expect(within(anchor).getByRole("tab", { name: "View Comment 1" })).toHaveAttribute("aria-selected", "true");
    await expect(within(anchor).getByLabelText("Comment 1 detail")).toHaveTextContent(
      "Keep the resource as a shelf item",
    );
  },
} satisfies Story;

export const EditMode = {
  args: {
    width: 390,
    height: 844,
    mode: "edit",
  },
  play: async ({ canvasElement }) => {
    const anchor = canvasElement.querySelector<HTMLElement>('[part="comment-anchor-badge"]');
    await expect(anchor).toBeInTheDocument();
    if (!anchor) {
      throw new Error("comment anchor badge not found");
    }
    await expect(within(anchor).getByRole("tab", { name: "Edit Comment 1" })).toHaveAttribute("aria-selected", "true");
  },
} satisfies Story;
