import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";

import { WorkspaceSessionsPanel } from "./WorkspaceSessionsPanel";

const workspace = {
  path: "/repo/demo",
  favorite: true,
  group: "OpenAI",
  missing: false,
  counts: {
    all: 1,
    running: 1,
    stopped: 0,
    archive: 0,
  },
};

const session = {
  sessionId: "session-abc-123",
  name: "Fix regression",
  status: "running",
  storageState: "active",
  favorite: false,
  createdAt: "2026-03-06T10:00:00.000Z",
  updatedAt: "2026-03-06T10:01:00.000Z",
  preview: {
    firstUserMessage: "Explain the failing tests",
    latestMessages: ["Investigated runtime state", "Need to patch workspace panel"],
  },
};

const meta = {
  title: "Features/Workspaces/WorkspaceSessionsPanel",
  component: WorkspaceSessionsPanel,
  args: {
    workspace,
    sessions: [session],
    selectedSessionId: null,
    onSelectSession: fn(),
    counts: workspace.counts,
    tab: "all",
    loading: false,
    loadingMore: false,
    hasMore: false,
    onChangeTab: fn(),
    onLoadMore: fn(),
    onCreateSessionInWorkspace: fn(),
    onOpenSession: fn(),
    onStopSession: fn(),
    onToggleSessionFavorite: fn(),
    onArchiveSession: fn(),
    onRestoreSession: fn(),
    onDeleteSession: fn(),
  },
  render: (args) => {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    return (
      <div className="grid h-[720px] grid-rows-[1fr_auto] gap-3 p-6">
        <WorkspaceSessionsPanel
          {...args}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
        />
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          selection: <span data-testid="selection-state">{selectedSessionId ?? "none"}</span>
        </div>
      </div>
    );
  },
} satisfies Meta<typeof WorkspaceSessionsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ToggleSelectionAndResume: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const selectionState = canvas.getByTestId("selection-state");
    const sessionToggle = canvas.getByTitle("session-abc-123");

    await userEvent.click(sessionToggle);
    await expect(selectionState).toHaveTextContent("session-abc-123");

    await userEvent.click(sessionToggle);
    await expect(selectionState).toHaveTextContent("none");

    await userEvent.click(canvas.getByRole("button", { name: "Resume Fix regression · session-abc-123" }));
    await expect(args.onOpenSession).toHaveBeenCalledWith("session-abc-123");
  },
};
