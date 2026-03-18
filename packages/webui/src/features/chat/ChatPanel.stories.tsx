import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { focusEditorSurface } from "./ai-input-story-utils";
import { ChatPanel } from "./ChatPanel";

const searchPaths = fn(async ({ query }: { cwd: string; query: string; limit?: number }) => {
  if (query === "@") {
    return [
      {
        label: "README.md",
        path: "README.md",
        isDirectory: false,
      },
      {
        label: "src/",
        path: "src/",
        isDirectory: true,
      },
    ];
  }
  return [];
});

const buildCycle = () => ({
  id: "cycle:7",
  cycleId: 7,
  seq: 7,
  createdAt: 7,
  wakeSource: "user",
  kind: "model" as const,
  status: "done" as const,
  clientMessageIds: ["client-7"],
  inputs: [
    {
      source: "message" as const,
      role: "user" as const,
      name: "User",
      parts: [
        { type: "text" as const, text: "Inspect the terminal state and attached diagram." },
        {
          type: "image" as const,
          assetId: "image-1",
          mimeType: "image/png",
          name: "diagram.png",
          sizeBytes: 2048,
          url: "https://placehold.co/320x240/png",
        },
      ],
      meta: { clientMessageId: "client-7" },
    },
    {
      source: "terminal" as const,
      role: "tool" as const,
      name: "Terminal-iflow",
      parts: [
        {
          type: "text" as const,
          text: JSON.stringify({
            kind: "terminal-diff",
            terminalId: "iflow",
            status: "IDLE",
            bytes: 332,
            diff: "diff --git a/output/latest.log.html",
          }),
        },
      ],
    },
  ],
  outputs: [
    {
      id: "msg-tool-call",
      role: "assistant" as const,
      channel: "tool_call" as const,
      content: ["```yaml+tool_call", "tool: terminal_read", "input:", "  terminalId: iflow", "```"].join("\n"),
      timestamp: 8,
      tool: { name: "terminal_read" },
    },
    {
      id: "msg-tool-result",
      role: "assistant" as const,
      channel: "tool_result" as const,
      content: [
        "```yaml+tool_result",
        "tool: terminal_read",
        "ok: true",
        "output:",
        "  kind: terminal-snapshot",
        "  terminalId: iflow",
        "  tail: |-",
        "    Hi~ What would you like to do today?",
        "    > Type your message",
        "```",
      ].join("\n"),
      timestamp: 9,
      tool: { name: "terminal_read", ok: true },
    },
    {
      id: "msg-assistant-1",
      role: "assistant" as const,
      channel: "to_user" as const,
      content: "Ready to inspect the terminal output with you.",
      timestamp: 10,
    },
  ],
  liveMessages: [],
  streaming: null,
  modelCallId: 11,
});

const meta = {
  title: "Features/Chat/ChatPanel",
  component: ChatPanel,
  args: {
    activeSessionName: "contract-check",
    workspacePath: "/repo/demo",
    aiStatus: "idle",
    disabled: false,
    imageEnabled: true,
    onSubmit: fn(async () => undefined),
    onSearchPaths: searchPaths,
    cycles: [buildCycle()],
  },
  render: (args) => (
    <div className="h-[720px] p-6">
      <ChatPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof ChatPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MergedToolConversation: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);

    await expect(canvas.getByText("cycle #7")).toBeInTheDocument();
    await expect(canvas.getByText("Ready to inspect the terminal output with you.")).toBeInTheDocument();

    await userEvent.click(canvas.getByAltText("diagram.png"));
    await expect(portal.getByRole("dialog", { name: "diagram.png" })).toBeInTheDocument();
    await userEvent.click(portal.getByRole("button", { name: "Close dialog" }));

    const editor = await focusEditorSurface(canvasElement, async (target) => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("Check @");

    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({ cwd: "/repo/demo", query: "@", limit: 8 });
    });
    await userEvent.click(await portal.findByText("README.md"));
    await waitFor(() => {
      expect(editor.textContent ?? "").toContain("Check @README.md");
    });

    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenCalledWith({ text: "Check @README.md", images: [] });
    });

    await userEvent.click(canvas.getByRole("button", { name: /terminal_read/i }));
    await expect(canvas.getByText("call")).toBeInTheDocument();
    await expect(canvas.getByText("result")).toBeInTheDocument();
  },
};

export const WorkingConversation: Story = {
  args: {
    aiStatus: "thinking",
    cycles: [
      {
        ...buildCycle(),
        id: "cycle:8",
        cycleId: 8,
        seq: 8,
        status: "streaming",
        outputs: [],
        liveMessages: [
          {
            id: "live-tool-call-1",
            role: "assistant",
            channel: "tool_call",
            content: ["```yaml+tool_call", "tool: terminal_read", "input:", "  terminalId: iflow", "```"].join("\n"),
            timestamp: 9,
            tool: { name: "terminal_read" },
          },
        ],
        streaming: {
          content: "I am still collecting terminal updates.",
        },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("AI thinking")).toBeInTheDocument();
    await expect(canvas.getByText("I am still collecting terminal updates.")).toBeInTheDocument();
    await expect(canvas.getByText("terminal_read")).toBeInTheDocument();
  },
};
