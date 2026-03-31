import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { SidebarNavContent, defaultPrimaryNavItems, type RunningSessionNavItem } from "./SidebarNav";

const sessionIconSvgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="18" fill="#155e75"/></svg>',
)}`;

const baseSessions: RunningSessionNavItem[] = [
  {
    sessionId: "session-running-1",
    name: "Fix layout drift",
    workspacePath: "/repo/agenter",
    iconUrl: sessionIconSvgUrl,
    active: true,
    unreadCount: 1,
    status: "running",
    onSelect: () => {},
  },
  {
    sessionId: "session-running-2",
    name: "Review bugfix",
    workspacePath: "/repo/openspecui",
    active: false,
    unreadCount: 3,
    status: "starting",
    onSelect: () => {},
  },
];

const longRunningSessions: RunningSessionNavItem[] = Array.from({ length: 24 }, (_, index) => ({
  sessionId: `session-running-${index + 1}`,
  name: `Running task ${index + 1}`,
  workspacePath: `/repo/group-${Math.floor(index / 6) + 1}/workspace-${index + 1}`,
  active: index === 0,
  unreadCount: index % 4,
  status: index % 3 === 0 ? "running" : index % 3 === 1 ? "starting" : "error",
  onSelect: () => {},
}));

const meta = {
  title: "Features/Shell/SidebarNav",
  component: SidebarNavContent,
  args: {
    compact: true,
    primaryItems: defaultPrimaryNavItems({
      quickStartActive: true,
      workspacesActive: false,
      terminalsActive: false,
      settingsActive: false,
      unreadWorkspaces: 4,
      onSelectQuickStart: () => {},
      onSelectWorkspaces: () => {},
      onSelectTerminals: () => {},
      onSelectSettings: () => {},
    }),
    runningSessions: baseSessions,
  },
  render: () => {
    const [activePrimary, setActivePrimary] = useState<"quickstart" | "workspaces" | "terminals" | "settings">("quickstart");
    const [activeSessionId, setActiveSessionId] = useState(baseSessions[0]?.sessionId ?? null);

    return (
      <div className="w-[20rem] p-6">
        <SidebarNavContent
          compact
          primaryItems={defaultPrimaryNavItems({
            quickStartActive: activePrimary === "quickstart",
            workspacesActive: activePrimary === "workspaces",
            terminalsActive: activePrimary === "terminals",
            settingsActive: activePrimary === "settings",
            unreadWorkspaces: 4,
            onSelectQuickStart: () => setActivePrimary("quickstart"),
            onSelectWorkspaces: () => setActivePrimary("workspaces"),
            onSelectTerminals: () => setActivePrimary("terminals"),
            onSelectSettings: () => setActivePrimary("settings"),
          })}
          runningSessions={baseSessions.map((item) => ({
            ...item,
            active: item.sessionId === activeSessionId,
            onSelect: () => setActiveSessionId(item.sessionId),
          }))}
        />
      </div>
    );
  },
} satisfies Meta<typeof SidebarNavContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SidebarShowsPrimaryAndRunningSessions: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sessionButton = canvas.getByRole("button", { name: /Review bugfix .*session-running-2 .*openspecui/i });

    await expect(canvas.getByText("Navigate")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /^Quick Start$/ })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /^Workspaces\b/i })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /^Global Settings$/ })).toBeInTheDocument();
    await expect(canvas.getByText("Running Sessions")).toBeInTheDocument();
    await expect(canvas.getByText("session-running-1")).toBeInTheDocument();
    await expect(canvas.getByText("session-running-2")).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: "Fix layout drift" })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Chat" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Devtools" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /^Settings$/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Start session" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Stop session" })).not.toBeInTheDocument();

    await userEvent.click(sessionButton);

    await expect(sessionButton).toHaveClass("bg-teal-50");
  },
};

export const SidebarLongRunningSessionListKeepsViewport: Story = {
  render: () => {
    const [activeSessionId, setActiveSessionId] = useState(longRunningSessions[0]?.sessionId ?? null);

    return (
      <div className="h-[480px] w-[20rem] p-6">
        <SidebarNavContent
          compact={false}
          primaryItems={defaultPrimaryNavItems({
            quickStartActive: false,
            workspacesActive: true,
            terminalsActive: false,
            settingsActive: false,
            unreadWorkspaces: 9,
            onSelectQuickStart: () => {},
            onSelectWorkspaces: () => {},
            onSelectTerminals: () => {},
            onSelectSettings: () => {},
          })}
          runningSessions={longRunningSessions.map((item) => ({
            ...item,
            active: item.sessionId === activeSessionId,
            onSelect: () => setActiveSessionId(item.sessionId),
          }))}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("sidebar-running-sessions-viewport");

    await expect(canvas.getByText("Running Sessions")).toBeInTheDocument();
    await expect(["auto", "scroll"]).toContain(getComputedStyle(viewport).overflowY);
  },
};

export const DesktopRailCanCollapseToIconWidth: Story = {
  render: () => {
    const [collapsed, setCollapsed] = useState(false);
    const [activePrimary, setActivePrimary] = useState<"quickstart" | "workspaces" | "terminals" | "settings">("workspaces");
    const [activeSessionId, setActiveSessionId] = useState(baseSessions[0]?.sessionId ?? null);

    return (
      <div className={collapsed ? "h-[480px] w-[4.75rem] p-3" : "h-[480px] w-[18.5rem] p-3"}>
        <SidebarNavContent
          compact={false}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((current) => !current)}
          primaryItems={defaultPrimaryNavItems({
            quickStartActive: activePrimary === "quickstart",
            workspacesActive: activePrimary === "workspaces",
            terminalsActive: activePrimary === "terminals",
            settingsActive: activePrimary === "settings",
            unreadWorkspaces: 4,
            onSelectQuickStart: () => setActivePrimary("quickstart"),
            onSelectWorkspaces: () => setActivePrimary("workspaces"),
            onSelectTerminals: () => setActivePrimary("terminals"),
            onSelectSettings: () => setActivePrimary("settings"),
          })}
          runningSessions={baseSessions.map((item) => ({
            ...item,
            active: item.sessionId === activeSessionId,
            onSelect: () => setActiveSessionId(item.sessionId),
          }))}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sidebar = canvas.getByText("Workspace-first shell").closest("[data-sidebar-collapsed]");
    if (!sidebar) {
      throw new Error("sidebar root not found");
    }

    await expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "false");
    await userEvent.click(canvas.getByRole("button", { name: "Collapse sidebar" }));
    await expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "true");
    await expect(canvas.queryByText("Workspace-first shell")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Quick Start")).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Workspaces" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Expand sidebar" }));
    await expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "false");
    await expect(canvas.getByText("Workspace-first shell")).toBeInTheDocument();
  },
};
