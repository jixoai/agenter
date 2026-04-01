import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";

import { SessionStatusPillMenu } from "../shell/SessionStatusPillMenu";
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

const renderSessionPill = (statusLabel: string, tone: "neutral" | "active" | "warning" | "danger", primaryActionLabel: string) => (
  <SessionStatusPillMenu
    statusLabel={statusLabel}
    tone={tone}
    primaryActionLabel={primaryActionLabel}
    onPrimaryAction={fn()}
    onAbort={fn()}
  />
);

const buildMessages = (input: RuntimeChatMessage[] = []): RuntimeChatMessage[] => {
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
  return [...base, ...input];
};

const MOBILE_ASSISTANT_REPLY = [
  "Decision: Since the automatic upgrade has failed twice, manual upgrade is required.",
  "",
  "Next:",
  "",
  "1. Current version: 0.5.15",
  "2. Available version: 0.5.18",
  "3. Status: Automatic upgrade failed twice",
  "4. Recommended action: `npm i -g @iflow/cli@latest`",
].join("\n");

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
      id: "msg-tool",
      role: "assistant",
      channel: "tool",
      content: [
        "```yaml",
        "invocationId: inv-terminal-read",
        "tool: terminal_read",
        "status: success",
        "call:",
        "  terminalId: iflow",
        "result:",
        "  kind: terminal-snapshot",
        "  terminalId: iflow",
        "```",
      ].join("\n"),
      timestamp: 9,
      cycleId: 7,
      tool: {
        invocationId: "inv-terminal-read",
        name: "terminal_read",
        status: "success",
        startedAt: 8,
        finishedAt: 9,
        call: { value: { terminalId: "iflow" } },
        result: { value: { kind: "terminal-snapshot", terminalId: "iflow" } },
      },
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
    sessionStateLabel: "Session running",
    statusSlot: renderSessionPill("Session running", "active", "Stop session"),
    disabled: false,
    imageEnabled: true,
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

    await expect(canvas.getByRole("button", { name: /Session status: Session running/ })).toBeInTheDocument();
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
  },
};

export const StreamingReply: Story = {
  args: {
    aiStatus: "waiting model",
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

export const LongPressShowsMessageActions: Story = {
  render: (args) => (
    <div className="h-[760px] w-[390px] p-4">
      <ChatPanel {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const assistantRow = canvasElement.querySelector("[data-message-role='assistant']");
    const assistantBubble = assistantRow?.querySelector("article");
    if (!(assistantBubble instanceof HTMLElement)) {
      throw new Error("Assistant bubble not found");
    }
    const portal = within(canvasElement.ownerDocument.body);

    fireEvent.pointerDown(assistantBubble, {
      pointerId: 7,
      pointerType: "touch",
      button: 0,
      clientX: 32,
      clientY: 48,
    });
    await new Promise((resolve) => window.setTimeout(resolve, 430));
    fireEvent.pointerUp(assistantBubble, {
      pointerId: 7,
      pointerType: "touch",
      button: 0,
      clientX: 32,
      clientY: 48,
    });
    await expect(await portal.findByText("View In Devtools")).toBeInTheDocument();
  },
};

export const ActionableStoppedNotice: Story = {
  args: {
    sessionStateLabel: "Session stopped",
    statusSlot: renderSessionPill("Session stopped", "neutral", "Start session"),
    messages: [],
    cycles: [],
    routeNotice: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: /Session status: Session stopped/ })).toBeInTheDocument();
    await expect(canvas.queryByText("Session is stopped. Start it to continue.")).not.toBeInTheDocument();
    await expect(
      canvas.getByText("Session stopped. Use the primary session action to begin or continue working."),
    ).toBeInTheDocument();
  },
};

export const LoadingConversationHistory: Story = {
  args: {
    messages: [],
    cycles: [],
    conversationState: "empty-loading",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Loading conversation...")).toBeInTheDocument();
    await expect(canvas.queryByText("Start the conversation")).not.toBeInTheDocument();
  },
};

export const RefreshingConversationHistory: Story = {
  args: {
    conversationState: "ready-loading",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Refreshing conversation...")).toBeInTheDocument();
    await expect(canvas.getAllByText("Ready to inspect the terminal output with you.").length).toBeGreaterThan(0);
  },
};

export const CompactConversationKeepsNavigationAndComposerStable: Story = {
  args: {
    messages: buildMessages([
      {
        id: "103",
        role: "assistant",
        channel: "to_user",
        content: MOBILE_ASSISTANT_REPLY,
        timestamp: 11,
        cycleId: 7,
      },
    ]),
    cycles: [buildCycle()],
  },
  render: (args) => (
    <div className="h-[667px] w-[375px] bg-slate-100">
      <ChatPanel {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = canvas.getByTestId("chat-panel");
    const viewport = canvas.getByTestId("chat-scroll-viewport");
    const toolbar = canvas.getByTestId("composer-toolbar");
    const actionBar = canvas.getByTestId("composer-action-bar");
    const statusBar = canvas.getByTestId("composer-status-bar");

    await expect(canvas.getByTestId("chat-route-status-strip")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Session status: Session running/ })).toBeInTheDocument();
    await expect(canvas.queryByText(/Cycle 7/i)).not.toBeInTheDocument();
    await expect(toolbar).toBeInTheDocument();
    await expect(canvas.getAllByRole("button", { name: "Message actions" }).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Ready to inspect the terminal output with you.").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Decision: Since the automatic upgrade has failed twice, manual upgrade is required.")).toBeInTheDocument();
    await waitFor(() => {
      expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
      expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
      expect(actionBar.scrollWidth).toBeLessThanOrEqual(actionBar.clientWidth + 1);
      expect(statusBar.scrollWidth).toBeLessThanOrEqual(statusBar.clientWidth + 1);
      expect(statusBar.getBoundingClientRect().height).toBeLessThan(40);
      expect(canvas.getByRole("button", { name: "Composer help" }).querySelector("svg")).toBeNull();
    });
  },
};

export const VirtualizedPersistedHistory: Story = {
  args: {
    messages: createRealSessionHistoryFixture().messages,
    cycles: [],
    sessionStateLabel: "Session running",
  },
  render: (args) => (
    <div className="h-[760px] p-6">
      <ChatPanel {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = await canvas.findByTestId("chat-scroll-viewport");

    await expect(
      await canvas.findByText("Assistant reply 14: completed the visible conversation turn 14."),
    ).toBeInTheDocument();
    await expect(viewport).toHaveClass("h-full");
    await expect(canvas.queryByText(/Cycle 14/i)).not.toBeInTheDocument();

    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);

    await waitFor(() => {
      expect(canvas.getByAltText("briefing.png")).toBeInTheDocument();
    });
  },
};
