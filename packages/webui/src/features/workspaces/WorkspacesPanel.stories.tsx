import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";

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

const meta = {
  title: "Features/Workspaces/WorkspacesPanel",
  component: WorkspacesPanel,
  args: {
    recentPaths: ["/repo/demo"],
    workspaces,
    selectedPath: null,
    onSelectPath: fn(),
    onToggleFavorite: fn(),
    onDeleteWorkspace: fn(),
    onCreateSessionInWorkspace: fn(),
    onCleanMissing: fn(),
    onActivatePath: fn(),
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

    await userEvent.click(canvas.getAllByTitle("/repo/demo")[0]!);
    await expect(canvas.getByTestId("workspace-selection")).toHaveTextContent("/repo/demo");

    await userEvent.dblClick(canvas.getAllByTitle("/repo/demo")[0]!);
    await expect(args.onActivatePath).toHaveBeenCalledWith("/repo/demo");

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
