import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, userEvent, within } from "storybook/test";

import Harness from "./review-shell-app-blueprint-harness.svelte";

const meta = {
  title: "WebChatView/Blueprints/ReviewShellApp",
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

export const CompactCanonical = {
  args: {
    width: 390,
    height: 844,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: "Messages" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("button", { name: "Open room chat" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Open room chat" }));
    await expect(canvas.getByText("Canonical review room")).toBeInTheDocument();
    await expect(canvas.getByText("Keep setup, sources, and profile out of the chat first viewport.")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Contacts" }));
    await expect(canvas.getByLabelText("Contacts blueprint")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Open Kai contact" }));
    await expect(canvas.getByText("Contact Details")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Start Chat" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Me" }));
    await userEvent.click(canvas.getByRole("button", { name: "Open source management" }));
    await expect(canvas.getByText("Sources")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Open remote lab source" }));
    await expect(canvas.getByText("Source Details")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Edit Source" })).toBeInTheDocument();
  },
} satisfies Story;
