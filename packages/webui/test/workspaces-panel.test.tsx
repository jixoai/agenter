import type { RuntimeClientState, WorkspaceSessionEntry } from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WorkspaceSessionsPanel } from "../src/features/workspaces/WorkspaceSessionsPanel";
import { WorkspacesPanel } from "../src/features/workspaces/WorkspacesPanel";

const workspace: RuntimeClientState["workspaces"][number] = {
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

const missingWorkspace: RuntimeClientState["workspaces"][number] = {
  path: "/repo/missing",
  favorite: false,
  group: "Other",
  missing: true,
  counts: {
    all: 0,
    running: 0,
    stopped: 0,
    archive: 0,
  },
};

const activeSession: WorkspaceSessionEntry = {
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

const archivedSession: WorkspaceSessionEntry = {
  ...activeSession,
  sessionId: "session-archive-123",
  status: "stopped",
  storageState: "archived",
  archivedAt: "2026-03-06T11:00:00.000Z",
  favorite: true,
};

afterEach(() => {
  cleanup();
});

describe("Feature: workspace browser", () => {
  test("Scenario: Given workspace list When rendering main panel Then session previews stay in the auxiliary page", () => {
    const onSelectPath = vi.fn();
    const onCreateSessionInWorkspace = vi.fn();
    const onDeleteWorkspace = vi.fn();

    render(
      <WorkspacesPanel
        recentPaths={["/repo/demo"]}
        workspaces={[workspace]}
        selectedPath={null}
        onSelectPath={onSelectPath}
        onToggleFavorite={() => {}}
        onDeleteWorkspace={onDeleteWorkspace}
        onCreateSessionInWorkspace={onCreateSessionInWorkspace}
        onCleanMissing={() => {}}
      />,
    );

    expect(screen.getAllByText("/repo/demo")).toHaveLength(3);
    expect(screen.queryByText("Investigated runtime state | Need to patch workspace panel")).not.toBeInTheDocument();
    expect(screen.getAllByText("running 1")).toHaveLength(3);

    fireEvent.click(screen.getAllByTitle("/repo/demo")[0]);
    expect(onSelectPath).toHaveBeenCalledWith("/repo/demo");

    fireEvent.click(screen.getAllByRole("button", { name: "Start new chat in /repo/demo" })[0]);
    expect(onCreateSessionInWorkspace).toHaveBeenCalledWith("/repo/demo");

    fireEvent.click(screen.getAllByRole("button", { name: "Delete workspace /repo/demo" })[0]);
    expect(screen.getByText("Delete workspace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteWorkspace).toHaveBeenCalledWith("/repo/demo");
  });

  test("Scenario: Given a workspace row When clicking it twice Then the shared selection contract toggles it off", () => {
    const Harness = () => {
      const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
      return (
        <WorkspacesPanel
          recentPaths={["/repo/demo"]}
          workspaces={[workspace]}
          selectedPath={selectedPath}
          onSelectPath={setSelectedPath}
          onToggleFavorite={() => {}}
          onDeleteWorkspace={() => {}}
          onCreateSessionInWorkspace={() => {}}
          onCleanMissing={() => {}}
        />
      );
    };

    render(<Harness />);

    const workspaceToggle = screen.getAllByTitle("/repo/demo")[0]!;
    fireEvent.click(workspaceToggle);
    expect(workspaceToggle.closest("article")).toHaveClass("border-teal-300");

    fireEvent.click(workspaceToggle);
    expect(workspaceToggle.closest("article")).toHaveClass("border-slate-200");
  });

  test("Scenario: Given missing workspaces When rendering main panel Then batch clean is available and new chat is disabled", () => {
    const onCleanMissing = vi.fn();

    render(
      <WorkspacesPanel
        recentPaths={[]}
        workspaces={[missingWorkspace]}
        selectedPath={null}
        onSelectPath={() => {}}
        onToggleFavorite={() => {}}
        onDeleteWorkspace={() => {}}
        onCreateSessionInWorkspace={() => {}}
        onCleanMissing={onCleanMissing}
      />,
    );

    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start new chat in /repo/missing" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Clean Missing/i }));
    expect(screen.getByText("Clean missing workspaces")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clean" }));
    expect(onCleanMissing).toHaveBeenCalledTimes(1);
  });

  test("Scenario: Given active sessions panel When clicking the same row twice Then selection toggles off", () => {
    const onOpenSession = vi.fn();

    const Harness = () => {
      const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);

      return (
        <WorkspaceSessionsPanel
          workspace={workspace}
          sessions={[activeSession]}
          counts={workspace.counts}
          tab="all"
          selectedSessionId={selectedSessionId}
          loading={false}
          loadingMore={false}
          hasMore={false}
          onChangeTab={() => {}}
          onSelectSession={setSelectedSessionId}
          onLoadMore={() => {}}
          onCreateSessionInWorkspace={() => {}}
          onOpenSession={onOpenSession}
          onStopSession={() => {}}
          onToggleSessionFavorite={() => {}}
          onArchiveSession={() => {}}
          onRestoreSession={() => {}}
          onDeleteSession={() => {}}
        />
      );
    };

    render(<Harness />);

    expect(screen.getByText("session-abc-123")).toBeInTheDocument();
    expect(screen.getByText("Investigated runtime state | Need to patch workspace panel")).toBeInTheDocument();

    const sessionToggle = screen.getByTitle("session-abc-123");
    fireEvent.click(sessionToggle);
    expect(screen.getByText("session-abc-123").closest("article")).toHaveClass("border-teal-300");

    fireEvent.click(sessionToggle);
    expect(screen.getByText("session-abc-123").closest("article")).toHaveClass("border-slate-200");

    fireEvent.click(screen.getByRole("button", { name: `Resume ${activeSession.name} · ${activeSession.sessionId}` }));
    expect(onOpenSession).toHaveBeenCalledWith("session-abc-123");
  });

  test("Scenario: Given sessions panel first load When no session rows are ready yet Then loading skeleton stays distinct from the empty state", () => {
    const { container } = render(
      <WorkspaceSessionsPanel
        workspace={workspace}
        sessions={[]}
        counts={workspace.counts}
        tab="all"
        selectedSessionId={null}
        loading
        loadingMore={false}
        hasMore={false}
        onChangeTab={() => {}}
        onSelectSession={() => {}}
        onLoadMore={() => {}}
        onCreateSessionInWorkspace={() => {}}
        onOpenSession={() => {}}
        onStopSession={() => {}}
        onToggleSessionFavorite={() => {}}
        onArchiveSession={() => {}}
        onRestoreSession={() => {}}
        onDeleteSession={() => {}}
      />,
    );

    expect(screen.queryByText("No sessions yet")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThan(0);
  });

  test("Scenario: Given missing workspace in sessions panel When rendering header Then new session is disabled but history stays visible", () => {
    render(
      <WorkspaceSessionsPanel
        workspace={missingWorkspace}
        sessions={[activeSession]}
        counts={missingWorkspace.counts}
        tab="all"
        selectedSessionId={null}
        loading={false}
        loadingMore={false}
        hasMore={false}
        onChangeTab={() => {}}
        onSelectSession={() => {}}
        onLoadMore={() => {}}
        onCreateSessionInWorkspace={() => {}}
        onOpenSession={() => {}}
        onStopSession={() => {}}
        onToggleSessionFavorite={() => {}}
        onArchiveSession={() => {}}
        onRestoreSession={() => {}}
        onDeleteSession={() => {}}
      />,
    );

    expect(
      screen.getByText(
        "This workspace folder is currently missing on disk. Existing sessions stay visible, but new sessions are disabled until the path is fixed or cleaned.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeDisabled();
    expect(screen.getByText("session-abc-123")).toBeInTheDocument();
  });

  test("Scenario: Given archive tab When rendering archived session Then restore action is available instead of chat", () => {
    const onRestoreSession = vi.fn();

    render(
      <WorkspaceSessionsPanel
        workspace={{ ...workspace, counts: { ...workspace.counts, all: 0, running: 0, archive: 1 } }}
        sessions={[archivedSession]}
        counts={{ all: 0, running: 0, stopped: 0, archive: 1 }}
        tab="archive"
        selectedSessionId={null}
        loading={false}
        loadingMore={false}
        hasMore={false}
        onChangeTab={() => {}}
        onSelectSession={() => {}}
        onLoadMore={() => {}}
        onCreateSessionInWorkspace={() => {}}
        onOpenSession={() => {}}
        onStopSession={() => {}}
        onToggleSessionFavorite={() => {}}
        onArchiveSession={() => {}}
        onRestoreSession={onRestoreSession}
        onDeleteSession={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: "Chat" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Restore session ${archivedSession.sessionId}` }));
    expect(screen.getByText("Restore session")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(onRestoreSession).toHaveBeenCalledWith(archivedSession.sessionId);
  });
});
