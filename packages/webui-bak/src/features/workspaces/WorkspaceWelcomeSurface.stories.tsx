import type { WorkspaceEntry, WorkspaceWelcomeSnapshotOutput } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { WorkspaceWelcomeSurface } from "./WorkspaceWelcomeSurface";

const EMPTY_COUNTS = {
  all: 0,
  running: 0,
  stopped: 0,
  archive: 0,
} as const;

const workspaces = [
  {
    path: "~/",
    favorite: false,
    group: "Global",
    missing: false,
    counts: EMPTY_COUNTS,
  },
  {
    path: "/repo/demo",
    favorite: true,
    group: "Workspace",
    missing: false,
    counts: EMPTY_COUNTS,
    lastSessionActivityAt: "2026-03-31T10:00:00.000Z",
  },
] satisfies WorkspaceEntry[];

const snapshot = {
  workspacePath: "/repo/demo",
  avatar: "default",
  sessionId: "session:/repo/demo:default",
  avatars: [
    {
      nickname: "default",
      defaultAvatar: true,
      sourceScope: "workspace",
      globalAvailable: true,
      workspaceAvailable: true,
      globalPath: "~/.agenter/avatar/default",
      workspacePath: "/repo/demo/.agenter/avatar/default",
      effectivePath: "/repo/demo/.agenter/avatar/default",
    },
  ],
  rooms: [
    {
      channel: {
        chatId: "room-main",
        kind: "room",
        title: "Room Main",
        owner: "nova",
        participants: [],
        createdAt: 1,
        updatedAt: 1,
        focused: false,
        accessRole: "admin",
        accessToken: "msgtok_room_main",
        transportUrl: "ws://localhost:7777/room/room-main?token=msgtok_room_main",
      },
      accessState: "available",
      seatStored: false,
      seatState: null,
      canAuthorize: true,
      seatRole: "member",
    },
    {
      channel: {
        chatId: "room-sync",
        kind: "room",
        title: "Daily Sync",
        owner: "nova",
        participants: [],
        createdAt: 2,
        updatedAt: 2,
        focused: true,
        accessRole: "readonly",
        accessToken: "msgtok_room_sync",
        transportUrl: "ws://localhost:7777/room/room-sync?token=msgtok_room_sync",
      },
      accessState: "joined",
      seatStored: true,
      seatState: "active",
      canAuthorize: true,
      seatRole: "readonly",
    },
  ],
  terminals: [
    {
      terminal: {
        terminalId: "term-main",
        processKind: "shell",
        command: ["bash"],
        cwd: "/repo/demo",
        workspace: null,
        running: true,
        status: "IDLE",
        seq: 1,
        focused: false,
        title: "Build Terminal",
        access: {
          role: "admin",
          accessToken: "termtok_term_main",
          currentAdmin: true,
        },
        actors: [],
      },
      accessState: "available",
      seatStored: false,
      seatState: null,
      canAuthorize: true,
      seatRole: "writer",
    },
    {
      terminal: {
        terminalId: "term-watch",
        processKind: "shell",
        command: ["bash", "-lc", "pnpm dev"],
        cwd: "/repo/demo",
        workspace: null,
        running: true,
        status: "BUSY",
        seq: 2,
        focused: true,
        title: "Watch Terminal",
        access: {
          role: "writer",
          accessToken: "termtok_term_watch",
          currentAdmin: false,
        },
        actors: [],
      },
      accessState: "credential-invalid",
      seatStored: true,
      seatState: "credential-invalid",
      canAuthorize: true,
      seatRole: "writer",
    },
  ],
} satisfies WorkspaceWelcomeSnapshotOutput;

const meta = {
  title: "Features/Workspaces/WorkspaceWelcomeSurface",
  component: WorkspaceWelcomeSurface,
  args: {
    loading: false,
    busy: false,
    workspaces,
    workspacePath: snapshot.workspacePath,
    avatar: snapshot.avatar,
    snapshot,
    selectedRoomIds: [],
    selectedTerminalIds: [],
    roomRoles: {},
    terminalRoles: {},
    onWorkspacePathChange: fn(),
    onAvatarChange: fn(),
    onToggleRoom: fn(),
    onToggleTerminal: fn(),
    onRoomRoleChange: fn(),
    onTerminalRoleChange: fn(),
    onRefresh: fn(),
    onOpenChats: fn(),
    onOpenTerminals: fn(),
    onStart: fn(),
  },
  render: (args) => {
    const [workspacePath, setWorkspacePath] = useState(snapshot.workspacePath);
    const [avatar, setAvatar] = useState(snapshot.avatar);
    const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
    const [selectedTerminalIds, setSelectedTerminalIds] = useState<string[]>([]);
    const [roomRoles, setRoomRoles] = useState<Record<string, "admin" | "member" | "readonly">>({
      "room-main": "member",
      "room-sync": "readonly",
    });
    const [terminalRoles, setTerminalRoles] = useState<Record<string, "admin" | "writer" | "requester" | "readonly">>({
      "term-main": "writer",
      "term-watch": "writer",
    });

    return (
      <div className="h-[880px] p-4">
        <WorkspaceWelcomeSurface
          {...args}
          workspacePath={workspacePath}
          avatar={avatar}
          selectedRoomIds={selectedRoomIds}
          selectedTerminalIds={selectedTerminalIds}
          roomRoles={roomRoles}
          terminalRoles={terminalRoles}
          onWorkspacePathChange={setWorkspacePath}
          onAvatarChange={setAvatar}
          onToggleRoom={(chatId) => {
            setSelectedRoomIds((current) =>
              current.includes(chatId) ? current.filter((value) => value !== chatId) : [...current, chatId],
            );
          }}
          onToggleTerminal={(terminalId) => {
            setSelectedTerminalIds((current) =>
              current.includes(terminalId) ? current.filter((value) => value !== terminalId) : [...current, terminalId],
            );
          }}
          onRoomRoleChange={(chatId, role) => {
            setRoomRoles((current) => ({
              ...current,
              [chatId]: role,
            }));
          }}
          onTerminalRoleChange={(terminalId, role) => {
            setTerminalRoles((current) => ({
              ...current,
              [terminalId]: role,
            }));
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof WorkspaceWelcomeSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SelectResourcesAndStart: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    await expect(canvas.getByText("credential-invalid")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: /Room Main/i }));
    await userEvent.click(canvas.getByRole("button", { name: /Build Terminal/i }));

    await expect(canvas.getByText("1 rooms")).toBeInTheDocument();
    await expect(canvas.getByText("1 terminals")).toBeInTheDocument();
    await expect(canvas.getAllByText("Grant role")).toHaveLength(2);

    await userEvent.click(canvas.getByRole("button", { name: "Start Avatar" }));
    await expect(args.onStart).toHaveBeenCalledTimes(1);
  },
};
