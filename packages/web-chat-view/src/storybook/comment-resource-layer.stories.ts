import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, waitFor, within } from "storybook/test";

import Harness from "./comment-resource-layer-harness.svelte";

const meta = {
  title: "WebChatView/Composites/CommentResourceLayer",
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
    open: true,
    mode: "view",
    editable: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole("dialog", { name: "Comment 7" });
    const anchorCard = within(dialog).getByLabelText("Selected text comment anchor");
    await expect(dialog).toBeInTheDocument();
    await expect(within(dialog).getByRole("tab", { name: /View/i })).toHaveAttribute("aria-selected", "true");
    await expect(within(anchorCard).getByText("Selected text")).toBeInTheDocument();
    await expect(within(anchorCard).getByText("Ava · Line 6")).toBeInTheDocument();
    await expect(within(dialog).getByText("Keep resource detail grouped in the shelf, not in the body.")).toBeInTheDocument();
  },
} satisfies Story;

export const EditMode = {
  args: {
    width: 390,
    height: 844,
    open: true,
    mode: "edit",
    editable: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const dialog = await waitFor(() => canvas.getByRole("dialog", { name: "Edit Comment 7" }));
    await expect(dialog).toBeInTheDocument();
    await expect(within(dialog).getByRole("tab", { name: /Edit/i })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(canvas.getByPlaceholderText("Add a selected-text comment")).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByRole("button", { name: "Save" })).toBeInTheDocument());
  },
} satisfies Story;
