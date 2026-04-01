import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { WorkspacesPanel } from "./WorkspacesPanel";

const workspaces = [
  {
    path: "/repo/demo",
    favorite: true,
    group: "OpenAI",
    missing: false,
    counts: { all: 3, running: 1, stopped: 1, archive: 1 },
  },
  {
    path: "/repo/missing",
    favorite: false,
    group: "Other",
    missing: true,
    counts: { all: 0, running: 0, stopped: 0, archive: 0 },
  },
];

const longWorkspaces = Array.from({ length: 40 }, (_, index) => ({
  path: `/repo/group-${Math.floor(index / 6) + 1}/workspace-${index + 1}`,
  favorite: index < 3,
  group: index < 12 ? "OpenAI" : index < 24 ? "Anthropic" : "Other",
  missing: false,
  counts: { all: index + 1, running: index % 3, stopped: index % 4, archive: index % 2 },
}));

const meta = {
  title: "Features/Workspaces/WorkspacesPanel",
  component: WorkspacesPanel,
  args: {
    recentPaths: ["/repo/demo"],
    workspaces,
    unreadByWorkspace: {
      "/repo/demo": 3,
    },
    selectedPath: null,
    onSelectPath: fn(),
    onToggleFavorite: fn(),
    onDeleteWorkspace: fn(),
    onCreateSessionInWorkspace: fn(),
    onCleanMissing: fn(),
  },
  render: (args) => {
    const [selectedPath, setSelectedPath] = useState<string | null>(null);

    return (
      <div className="grid h-[860px] grid-rows-[1fr_auto] gap-3 p-6">
        <WorkspacesPanel {...args} selectedPath={selectedPath} onSelectPath={setSelectedPath} />
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          selection: <span data-testid="workspace-selection">{selectedPath ?? "none"}</span>
        </div>
      </div>
    );
  },
} satisfies Meta<typeof WorkspacesPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SelectDeleteAndClean: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);

    await expect(canvas.getAllByText("3 unread").length).toBeGreaterThan(0);
    await userEvent.click(canvas.getAllByTitle("/repo/demo")[0]!);
    await expect(canvas.getByTestId("workspace-selection")).toHaveTextContent("/repo/demo");

    await userEvent.click(canvas.getAllByTitle("/repo/demo")[0]!);
    await expect(canvas.getByTestId("workspace-selection")).toHaveTextContent("none");

    await userEvent.click(canvas.getAllByRole("button", { name: "Start new chat in /repo/demo" })[0]!);
    await expect(args.onCreateSessionInWorkspace).toHaveBeenCalledWith("/repo/demo");

    await userEvent.click(canvas.getAllByRole("button", { name: "Delete workspace /repo/demo" })[0]!);
    await expect(portal.getByRole("dialog", { name: "Delete workspace" })).toBeInTheDocument();
    await userEvent.click(portal.getByRole("button", { name: "Delete" }));
    await expect(args.onDeleteWorkspace).toHaveBeenCalledWith("/repo/demo");

    await userEvent.type(canvas.getByPlaceholderText("Search workspace or group"), "missing");
    await expect(canvas.getByText("/repo/missing")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: /Clean Missing/i }));
    await expect(portal.getByRole("dialog", { name: "Clean missing workspaces" })).toBeInTheDocument();
    await userEvent.click(portal.getByRole("button", { name: "Clean" }));
    await expect(args.onCleanMissing).toHaveBeenCalledTimes(1);
  },
};

export const LongWorkspaceListKeepsSingleScrollViewport: Story = {
  args: {
    workspaces: longWorkspaces,
    recentPaths: longWorkspaces.slice(0, 5).map((item) => item.path),
    unreadByWorkspace: Object.fromEntries(longWorkspaces.slice(0, 6).map((item, index) => [item.path, index + 1])),
  },
  render: (args) => {
    const [selectedPath, setSelectedPath] = useState<string | null>(null);

    return (
      <div className="h-[460px] p-4">
        <WorkspacesPanel {...args} selectedPath={selectedPath} onSelectPath={setSelectedPath} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Workspaces")).toBeInTheDocument();
    const viewport = canvas.getByTestId("workspaces-scroll-viewport");
    await expect(viewport).not.toBeNull();
    await expect(["auto", "scroll"]).toContain(getComputedStyle(viewport).overflowY);
  },
};
