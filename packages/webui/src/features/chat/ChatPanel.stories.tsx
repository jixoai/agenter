import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { focusEditorSurface } from "./ai-input-story-utils";
import { ChatPanel } from "./ChatPanel";
import { createRealSessionHistoryFixture } from "./real-session-history-fixture";

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

const buildMessages = (input?: Partial<RuntimeChatMessage>[]): RuntimeChatMessage[] => {
  const base: RuntimeChatMessage[] = [
    {
      id: "101",
      role: "user",
      content: "Inspect the terminal state and attached diagram.",
      timestamp: 7,
      cycleId: null,
      attachments: [
        {
          assetId: "image-1",
          kind: "image",
          mimeType: "image/png",
          name: "diagram.png",
          sizeBytes: 2048,
          url: "https://placehold.co/320x240/png",
        },
      ],
    },
    {
      id: "102",
      role: "assistant",
      channel: "to_user",
      content: "Ready to inspect the terminal output with you.",
      timestamp: 10,
      cycleId: 7,
    },
  ];
  return input ? [...base, ...input] : base;
};

const buildCycle = (input?: Partial<RuntimeChatCycle>): RuntimeChatCycle => ({
  id: "cycle:7",
  cycleId: 7,
  seq: 7,
  createdAt: 7,
  wakeSource: "user",
  kind: "model",
  status: "done",
  clientMessageIds: ["client-7"],
  inputs: [
    {
      source: "message",
      role: "user",
      name: "User",
      parts: [
        { type: "text", text: "Inspect the terminal state and attached diagram." },
        {
          type: "image",
          assetId: "image-1",
          kind: "image",
          mimeType: "image/png",
          name: "diagram.png",
          sizeBytes: 2048,
          url: "https://placehold.co/320x240/png",
        },
      ],
      meta: { clientMessageId: "client-7" },
    },
  ],
  outputs: [
    {
      id: "msg-tool-call",
      role: "assistant",
      channel: "tool_call",
      content: ["```yaml+tool_call", "tool: terminal_read", "input:", "  terminalId: iflow", "```"].join("\n"),
      timestamp: 8,
      cycleId: 7,
      tool: { name: "terminal_read" },
    },
    {
      id: "msg-tool-result",
      role: "assistant",
      channel: "tool_result",
      content: [
        "```yaml+tool_result",
        "tool: terminal_read",
        "ok: true",
        "output:",
        "  kind: terminal-snapshot",
        "  terminalId: iflow",
        "```",
      ].join("\n"),
      timestamp: 9,
      cycleId: 7,
      tool: { name: "terminal_read", ok: true },
    },
    {
      id: "msg-thought",
      role: "assistant",
      channel: "self_talk",
      content: "hidden internal note",
      timestamp: 9,
      cycleId: 7,
    },
    {
      id: "msg-assistant-1",
      role: "assistant",
      channel: "to_user",
      content: "Ready to inspect the terminal output with you.",
      timestamp: 10,
      cycleId: 7,
    },
  ],
  liveMessages: [],
  streaming: null,
  modelCallId: 11,
  ...input,
});

const meta = {
  title: "Features/Chat/ChatPanel",
  component: ChatPanel,
  args: {
    workspacePath: "/repo/demo",
    aiStatus: "idle",
    sessionStateLabel: "Session stopped",
    sessionStateTone: "neutral",
    disabled: false,
    imageEnabled: true,
    sessionActionLabel: "Start session",
    onSessionAction: fn(async () => undefined),
    onSubmit: fn(async () => undefined),
    onSearchPaths: searchPaths,
    onOpenDevtools: fn(),
    messages: buildMessages(),
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

export const ConversationFirstHistory: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);

    await expect(canvas.getAllByText("Inspect the terminal state and attached diagram.").length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Ready to inspect the terminal output with you.").length).toBeGreaterThan(0);
    await expect(canvas.queryByText(/Cycle 7/i)).not.toBeInTheDocument();
    await expect(canvas.queryByText("terminal_read")).not.toBeInTheDocument();
    await expect(canvas.queryByText("hidden internal note")).not.toBeInTheDocument();

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
      expect(args.onSubmit).toHaveBeenCalledWith({ text: "Check @README.md", assets: [] });
    });

    await expect(canvas.getByRole("button", { name: "Start session" })).toBeInTheDocument();
  },
};

export const StreamingReply: Story = {
  args: {
    aiStatus: "waiting model",
    sessionStateLabel: "Session running",
    sessionStateTone: "active",
    sessionActionLabel: "Stop session",
    messages: buildMessages(),
    cycles: [
      buildCycle({
        id: "cycle:8",
        cycleId: 8,
        seq: 8,
        status: "streaming",
        outputs: [],
        liveMessages: [
          {
            id: "live-thought-1",
            role: "assistant",
            channel: "self_talk",
            content: "hidden streaming trace",
            timestamp: 11,
            cycleId: 8,
          },
        ],
        streaming: {
          content: "I am still collecting terminal updates.",
        },
      }),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: "Stop session" })).toBeInTheDocument();
    await expect(canvas.getAllByText("I am still collecting terminal updates.").length).toBeGreaterThan(0);
    await expect(canvas.queryByText(/Cycle 8/i)).not.toBeInTheDocument();
    await expect(canvas.queryByText("hidden streaming trace")).not.toBeInTheDocument();
    await expect(canvas.queryByText("terminal_read")).not.toBeInTheDocument();
  },
};

export const MessageActionsOpenDevtools: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getAllByRole("button", { name: "Message actions" })[1]!);
    await userEvent.click(await portal.findByText("View In Devtools"));

    await waitFor(() => {
      expect(args.onOpenDevtools).toHaveBeenCalledWith(7);
    });
  },
};

export const ActionableStoppedNotice: Story = {
  args: {
    messages: [],
    cycles: [],
    routeNotice: {
      tone: "warning",
      message: "Session is stopped. Start it to continue.",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByText("Session is stopped. Start it to continue.")).toHaveLength(2);
    await expect(canvas.getByRole("button", { name: "Start session" })).toBeInTheDocument();
  },
};

export const CompactConversationKeepsNavigationAndComposerStable: Story = {
  args: {
    messages: buildMessages(),
    cycles: [buildCycle()],
  },
  render: (args) => (
    <div className="h-[760px] max-w-[390px] p-4">
      <ChatPanel {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByText(/Cycle 7/i)).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Send" })).toBeInTheDocument();
    await expect(canvas.getAllByRole("button", { name: "Message actions" }).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Ready to inspect the terminal output with you.").length).toBeGreaterThan(0);
  },
};

export const VirtualizedPersistedHistory: Story = {
  args: {
    messages: createRealSessionHistoryFixture().messages,
    cycles: [],
    sessionStateLabel: "Session running",
    sessionStateTone: "active",
    sessionActionLabel: "Stop session",
  },
  render: (args) => (
    <div className="h-[760px] p-6">
      <ChatPanel {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = await canvas.findByTestId("chat-scroll-viewport");

    await expect(canvas.getByText("Assistant reply 14: completed the visible conversation turn 14.")).toBeInTheDocument();
    await expect(canvas.getByAltText("briefing.png")).toBeInTheDocument();
    await expect(viewport).toHaveClass("flex-1");
    await expect(canvas.queryByText(/Cycle 14/i)).not.toBeInTheDocument();
  },
};
