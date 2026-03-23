import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { TopHeader } from "./TopHeader";

const meta = {
  title: "Features/Shell/TopHeader",
  component: TopHeader,
  args: {
    locationLabel: "Chat",
    showNavigationTrigger: false,
    connectionStatus: "connected",
    aiStatus: "working",
    onOpenNavigation: fn(),
  },
  render: (args) => (
    <div className="w-[800px] p-6">
      <TopHeader {...args} />
    </div>
  ),
} satisfies Meta<typeof TopHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PassiveDesktopHeader: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("agenter")).toBeInTheDocument();
    await expect(canvas.getByText("Chat")).toBeInTheDocument();
    await expect(canvas.getByLabelText("Connected")).toBeInTheDocument();
    await expect(canvas.getByLabelText("AI working")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Open global settings" })).not.toBeInTheDocument();
  },
};

export const CompactHeaderKeepsOnlyNavigationTrigger: Story = {
  args: {
    showNavigationTrigger: true,
    aiStatus: null,
  },
  render: (args) => (
    <div className="w-[320px] p-4" data-testid="compact-top-header-shell">
      <TopHeader {...args} />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const shell = canvas.getByTestId("compact-top-header-shell");

    await expect(canvas.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
    await expect(canvas.queryByLabelText(/AI /)).not.toBeInTheDocument();
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth + 1);
    await expect(args.onOpenNavigation).not.toHaveBeenCalled();
  },
};

export const WorkspaceHeaderKeepsTabsAndBasenameOnly: Story = {
  args: {
    locationLabel: "Workspace",
    workspace: {
      workspacePath: "/repo/demo/project-alpha",
      activeTab: "chat",
      onNavigate: fn(),
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("project-alpha")).toBeInTheDocument();
    await expect(canvas.queryByText("/repo/demo/project-alpha")).not.toBeInTheDocument();
    await expect(canvas.getByTitle("/repo/demo/project-alpha")).toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Chat" })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: "Devtools" }));
    await expect(args.workspace?.onNavigate).toHaveBeenCalledWith("devtools");
    await expect(canvas.queryByRole("button", { name: "Global Settings" })).not.toBeInTheDocument();
  },
};

export const OfflineHeaderShowsTransportState: Story = {
  args: {
    connectionStatus: "offline",
    aiStatus: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Offline")).toBeInTheDocument();
  },
};

export const ReconnectingHeaderShowsTransportState: Story = {
  args: {
    connectionStatus: "reconnecting",
    aiStatus: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Reconnecting")).toBeInTheDocument();
  },
};
