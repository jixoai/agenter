import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { AssistantMarkdown } from "./AssistantMarkdown";

const meta = {
  title: "Features/Chat/AssistantMarkdown",
  component: AssistantMarkdown,
  args: {
    content: "Observation: terminal idle",
    channel: "self_talk",
  },
  render: (args) => (
    <div className="mx-auto w-[min(720px,100vw)] p-6">
      <AssistantMarkdown {...args} />
    </div>
  ),
} satisfies Meta<typeof AssistantMarkdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ToolTraceAccordion: Story = {
  args: {
    content: "",
    toolTrace: {
      id: "tool-terminal-read",
      toolName: "terminal_read",
      status: "done",
      meta: "iflow · terminal-snapshot · #30 · 80x24",
      callContent: ["tool: terminal_read", "input:", "  terminalId: iflow"].join("\n"),
      resultContent: ["tool: terminal_read", "output:", "  kind: terminal-snapshot"].join("\n"),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /terminal_read/i });

    await expect(canvas.getByText("iflow · terminal-snapshot · #30 · 80x24")).toBeInTheDocument();
    await expect(canvas.queryByText("call")).not.toBeInTheDocument();

    await userEvent.click(trigger);

    await expect(canvas.getByText("call")).toBeInTheDocument();
    await expect(canvas.getByText("result")).toBeInTheDocument();
    await expect(canvas.getByText("terminal-snapshot")).toBeInTheDocument();
  },
};
