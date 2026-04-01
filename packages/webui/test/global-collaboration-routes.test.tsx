import type {
  AuthActorCatalogEntry,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  RuntimeClientState,
  TerminalActivityItem,
} from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { routeTestState } = vi.hoisted(() => ({
  routeTestState: {
    controller: null as Record<string, unknown> | null,
    runtimeState: null as RuntimeClientState | null,
  },
}));

interface ActorTokenAccessoryProps {
  options: Array<{ accessToken: string }>;
  onChange: (accessToken: string) => void;
}

const isActorTokenAccessoryElement = (value: unknown): value is ReactElement<ActorTokenAccessoryProps> => {
  return isValidElement<ActorTokenAccessoryProps>(value) && Array.isArray(value.props.options) && typeof value.props.onChange === "function";
};

vi.mock("../src/app-context", () => ({
  useAppController: () => {
    if (!routeTestState.controller) {
      throw new Error("route test controller is not initialized");
    }
    return routeTestState.controller;
  },
  useRuntimeSelector: (selector: (state: RuntimeClientState) => unknown) => {
    if (!routeTestState.runtimeState) {
      throw new Error("route test runtime state is not initialized");
    }
    return selector(routeTestState.runtimeState);
  },
}));

vi.mock("../src/features/chat/MessageChannelSurface", () => ({
  MessageChannelSurface: (props: {
    channels: GlobalRoomEntry[];
    selectedChatId: string | null;
    disabled: boolean;
    sidePanel?: ReactNode;
    renderComposerAccessory?: (props: unknown) => ReactNode;
    onSendMessage: (input: { channel: GlobalRoomEntry; payload: { text: string; assets: File[] } }) => Promise<void> | void;
  }) => {
    const selectedChannel = props.channels.find((channel) => channel.chatId === props.selectedChatId) ?? props.channels[0] ?? null;
    const composerAccessory = selectedChannel
      ? props.renderComposerAccessory?.({ channel: selectedChannel, disabled: props.disabled } as never)
      : null;
    const alternateToken = isActorTokenAccessoryElement(composerAccessory) ? composerAccessory.props.options[1]?.accessToken ?? null : null;
    return (
      <div>
        <output data-testid="room-disabled">{String(props.disabled)}</output>
        {alternateToken ? (
          <button
            type="button"
            onClick={() => {
              if (!isActorTokenAccessoryElement(composerAccessory)) {
                return;
              }
              composerAccessory.props.onChange(alternateToken);
            }}
          >
            Select alternate room caller
          </button>
        ) : null}
        {composerAccessory}
        <button
          type="button"
          onClick={() => {
            if (!selectedChannel) {
              return;
            }
            void props.onSendMessage({
              channel: selectedChannel,
              payload: { text: "hello from room", assets: [] },
            });
          }}
        >
          Send test global room message
        </button>
        {props.sidePanel}
      </div>
    );
  },
}));

vi.mock("../src/features/terminal/GlobalTerminalWorkbench", () => ({
  GlobalTerminalWorkbench: (props: {
    onSelectTerminal: (terminalId: string) => void;
    selectedCallerToken: string | null;
    onSelectCallerToken: (accessToken: string) => void;
    onSetUserFocus: (input: { actorId: string; accessToken: string; focused: boolean }) => Promise<void> | void;
    onReadTerminal: (input: {
      accessToken?: string;
      mode?: "auto" | "diff" | "snapshot";
      remark?: boolean;
    }) => Promise<void> | void;
    onWriteTerminal: (input: {
      accessToken?: string;
      text: string;
      submit?: boolean;
      submitKey?: "enter" | "linefeed";
    }) => Promise<void> | void;
  }) => (
    <div>
      <output data-testid="terminal-caller-token">{props.selectedCallerToken ?? ""}</output>
      <button type="button" onClick={() => props.onSelectTerminal("term-main")}>
        Inspect terminal tab
      </button>
      <button type="button" onClick={() => props.onSelectCallerToken("termtok_writer")}>
        Select alternate terminal caller
      </button>
      <button
        type="button"
        onClick={() =>
          void props.onSetUserFocus({
            actorId: "session:observer",
            accessToken: "termtok_writer",
            focused: false,
          })
        }
      >
        Focus observer seat
      </button>
      <button
        type="button"
        onClick={() =>
          void props.onReadTerminal({
            accessToken: props.selectedCallerToken ?? undefined,
            mode: "diff",
            remark: true,
          })
        }
      >
        Read terminal via route
      </button>
      <button
        type="button"
        onClick={() =>
          void props.onWriteTerminal({
            accessToken: props.selectedCallerToken ?? undefined,
            text: "pwd",
            submit: true,
            submitKey: "enter",
          })
        }
      >
        Write terminal via route
      </button>
    </div>
  ),
}));

import { GlobalChatsRoute } from "../src/features/chat/GlobalChatsRoute";
import { GlobalTerminalsRoute } from "../src/features/terminal/GlobalTerminalsRoute";

const createRuntimeState = (): RuntimeClientState => ({
  connected: true,
  connectionStatus: "connected",
  profileService: {
    endpoint: "http://127.0.0.1:4591",
    authMode: "wallet_challenge_jwt",
    rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
    rootIdentifier: {
      kind: "wallet_evm",
      value: "0x0000000000000000000000000000000000000001",
    },
    rootAuthKeyPath: "~/.agenter/profile-service/root-auth.key",
    jwtTtlSeconds: 3600,
    rootAuthBootstrapMode: "managed_local",
    canRevealRootAuthPrivateKey: true,
    hasManagedRootAuthPrivateKey: true,
  },
  lastEventId: 0,
  sessions: [],
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  terminalReadsBySession: {},
  chatsBySession: {},
  messageChannelsBySession: {},
  chatCyclesBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
  schedulerLogsBySession: {},
  observabilityTracesBySession: {},
  apiCallsBySession: {},
  modelCallsBySession: {},
  terminalActivityBySession: {},
  apiCallRecordingBySession: {},
  notifications: [],
  unreadBySession: {},
  unreadByChat: {},
  unreadByTerminal: {},
});

const createGlobalRoom = (): GlobalRoomEntry => ({
  chatId: "room-main",
  kind: "room",
  title: "Room Main",
  owner: "Owner",
  participants: [
    { id: "auth:owner", label: "Owner" },
    { id: "session:observer", label: "Observer" },
  ],
  createdAt: 1,
  updatedAt: 1,
  focused: true,
  accessRole: "admin",
  accessToken: "msgtok_owner",
  participantId: "auth:owner",
  transportUrl: "ws://localhost/room-main",
  metadata: {},
});

const createGlobalRoomGrant = (): GlobalRoomGrantEntry => ({
  grantId: "grant-member",
  chatId: "room-main",
  role: "member",
  label: "Observer",
  participantId: "session:observer",
  createdAt: 2,
  accessToken: "msgtok_member",
});

const createGlobalTerminal = (): GlobalTerminalEntry => ({
  terminalId: "term-main",
  processKind: "shell",
  command: ["bash"],
  cwd: "/repo/demo",
  workspace: null,
  running: true,
  status: "IDLE",
  seq: 1,
  focused: true,
  title: "Build Terminal",
  shortcuts: {},
  rendererEngine: "xterm",
  transportUrl: "ws://localhost/term-main",
  currentAdminId: "auth:owner",
  approvalTimeoutMs: 90_000,
  pendingRequestCount: 0,
  access: {
    role: "admin",
    accessToken: "termtok_owner",
    participantId: "auth:owner",
    currentAdmin: true,
    adminCandidateRank: 0,
  },
  actors: [
    {
      actorId: "auth:owner",
      role: "admin",
      currentAdmin: true,
      adminCandidateRank: 0,
      online: true,
      focused: true,
    },
    {
      actorId: "session:observer",
      role: "writer",
      currentAdmin: false,
      online: true,
      focused: false,
    },
  ],
});

const createGlobalTerminalGrant = (): GlobalTerminalGrantEntry => ({
  grantId: "grant-writer",
  terminalId: "term-main",
  role: "writer",
  label: "Observer",
  participantId: "session:observer",
  accessToken: "termtok_writer",
  createdAt: 2,
});

const createTerminalActivityItem = (): TerminalActivityItem => ({
  id: 1,
  terminalId: "term-main",
  createdAt: 1,
  actorId: "auth:owner",
  cycleId: null,
  kind: "terminal_read",
  title: "terminal_read",
  content: "prompt$",
});

const createAuthActors = (): AuthActorCatalogEntry[] => [
  {
    actorId: "auth:owner",
    actorKind: "auth",
    authId: "owner",
    profileId: "profile-owner",
    label: "Owner",
    subtitle: "wallet_evm:0xowner",
    iconUrl: "http://127.0.0.1:4591/media/profiles/profile-owner/icon",
    identifier: {
      kind: "wallet_evm",
      value: "0xowner",
    },
  },
];

beforeEach(() => {
  routeTestState.runtimeState = createRuntimeState();
  routeTestState.controller = null;
});

afterEach(() => {
  cleanup();
  routeTestState.controller = null;
});

describe("Feature: global collaboration routes", () => {
  test("Scenario: Given a room with multiple seat tokens When the caller token changes Then global room send uses the selected token", async () => {
    const listGlobalRooms = vi.fn(async () => [createGlobalRoom()]);
    const snapshotGlobalRoom = vi.fn(async () => ({
      channel: createGlobalRoom(),
      items: [],
      nextBefore: null,
      hasMoreBefore: false,
      headVersion: "1",
    }));
    const listGlobalRoomGrants = vi.fn(async () => [createGlobalRoomGrant()]);
    const sendGlobalRoomMessage = vi.fn(async () => ({ ok: true as const }));

    routeTestState.controller = {
      runtimeStore: {
        listAuthActors: async () => createAuthActors(),
        profileIconUrl: (reference: string) => `http://127.0.0.1:4591/media/profiles/${reference}/icon`,
        sessionIconUrl: (sessionId: string) => `http://127.0.0.1:4591/media/sessions/${sessionId}/icon`,
      },
      authSession: null,
      listGlobalRooms,
      snapshotGlobalRoom,
      listGlobalRoomGrants,
      sendGlobalRoomMessage,
      createGlobalRoom: vi.fn(),
      focusGlobalRooms: vi.fn(async () => ({ ok: true as const, message: "focused", focusedChatIds: ["room-main"] })),
      archiveGlobalRoom: vi.fn(),
      updateGlobalRoom: vi.fn(),
      issueGlobalRoomGrant: vi.fn(),
      revokeGlobalRoomGrant: vi.fn(),
    };

    render(<GlobalChatsRoute />);

    await screen.findByRole("button", { name: "Select alternate room caller" });
    fireEvent.click(screen.getByRole("button", { name: "Select alternate room caller" }));
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Send as" })).toHaveValue("msgtok_member");
    });
    fireEvent.click(screen.getByRole("button", { name: "Send test global room message" }));

    await waitFor(() => {
      expect(sendGlobalRoomMessage).toHaveBeenCalledWith({
        chatId: "room-main",
        accessToken: "msgtok_member",
        payload: { text: "hello from room", assets: [] },
      });
    });
  });

  test("Scenario: Given room users with their own room tokens When a seat focus button is pressed Then the route uses that seat token instead of a room-global toggle", async () => {
    const listGlobalRooms = vi.fn(async () => [createGlobalRoom()]);
    const snapshotGlobalRoom = vi.fn(async () => ({
      channel: createGlobalRoom(),
      items: [],
      nextBefore: null,
      hasMoreBefore: false,
      headVersion: "1",
    }));
    const listGlobalRoomGrants = vi.fn(async () => [createGlobalRoomGrant()]);
    const focusGlobalRooms = vi.fn(async () => ({ ok: true as const, message: "focused", focusedChatIds: ["room-main"] }));

    routeTestState.controller = {
      runtimeStore: {
        listAuthActors: async () => createAuthActors(),
        profileIconUrl: (reference: string) => `http://127.0.0.1:4591/media/profiles/${reference}/icon`,
        sessionIconUrl: (sessionId: string) => `http://127.0.0.1:4591/media/sessions/${sessionId}/icon`,
      },
      authSession: null,
      listGlobalRooms,
      snapshotGlobalRoom,
      listGlobalRoomGrants,
      sendGlobalRoomMessage: vi.fn(async () => ({ ok: true as const })),
      createGlobalRoom: vi.fn(),
      focusGlobalRooms,
      archiveGlobalRoom: vi.fn(),
      deleteGlobalRoom: vi.fn(),
      updateGlobalRoom: vi.fn(),
      issueGlobalRoomGrant: vi.fn(),
      revokeGlobalRoomGrant: vi.fn(),
    };

    render(<GlobalChatsRoute />);

    fireEvent.click(await screen.findByRole("button", { name: "Focus Observer" }));

    await waitFor(() => {
      expect(focusGlobalRooms).toHaveBeenCalledWith({
        op: "add",
        channels: [{ chatId: "room-main", accessToken: "msgtok_member" }],
      });
    });
  });

  test("Scenario: Given a terminal with multiple seat tokens When the caller token changes Then read and write both use the selected token", async () => {
    const listGlobalTerminals = vi.fn(async () => [createGlobalTerminal()]);
    const loadGlobalTerminalActivity = vi.fn(async () => ({
      items: [createTerminalActivityItem()],
      hasMore: false,
      nextBefore: null,
    }));
    const listGlobalTerminalGrants = vi.fn(async () => [createGlobalTerminalGrant()]);
    const readGlobalTerminal = vi.fn(async () => ({ ok: true as const }));
    const writeGlobalTerminal = vi.fn(async () => ({ ok: true as const }));

    routeTestState.controller = {
      runtimeStore: {
        listAuthActors: async () => createAuthActors(),
        profileIconUrl: (reference: string) => `http://127.0.0.1:4591/media/profiles/${reference}/icon`,
        sessionIconUrl: (sessionId: string) => `http://127.0.0.1:4591/media/sessions/${sessionId}/icon`,
      },
      authSession: null,
      listGlobalTerminals,
      focusGlobalTerminals: vi.fn(async () => ({ ok: true as const, message: "focused", focusedTerminalIds: ["term-main"] })),
      loadGlobalTerminalActivity,
      listGlobalTerminalGrants,
      createGlobalTerminal: vi.fn(async () => ({ ok: true as const, message: "created", terminal: createGlobalTerminal() })),
      deleteGlobalTerminal: vi.fn(async () => ({ ok: true as const, message: "deleted" })),
      issueGlobalTerminalGrant: vi.fn(),
      revokeGlobalTerminalGrant: vi.fn(),
      listGlobalTerminalApprovalRequests: vi.fn(async () => []),
      approveGlobalTerminalRequest: vi.fn(async () => ({ ok: true as const })),
      denyGlobalTerminalRequest: vi.fn(async () => ({ ok: true as const })),
      readGlobalTerminal,
      writeGlobalTerminal,
    };

    render(<GlobalTerminalsRoute />);

    await screen.findByRole("button", { name: "Select alternate terminal caller" });
    fireEvent.click(screen.getByRole("button", { name: "Select alternate terminal caller" }));
    await waitFor(() => {
      expect(screen.getByTestId("terminal-caller-token")).toHaveTextContent("termtok_writer");
    });
    fireEvent.click(screen.getByRole("button", { name: "Read terminal via route" }));
    fireEvent.click(screen.getByRole("button", { name: "Write terminal via route" }));

    await waitFor(() => {
      expect(readGlobalTerminal).toHaveBeenCalledWith({
        terminalId: "term-main",
        accessToken: "termtok_writer",
        mode: "diff",
        remark: true,
      });
    });
    await waitFor(() => {
      expect(writeGlobalTerminal).toHaveBeenCalledWith({
        terminalId: "term-main",
        accessToken: "termtok_writer",
        text: "pwd",
        submit: true,
        submitKey: "enter",
        returnRead: true,
      });
    });
  });

  test("Scenario: Given the global terminal page When switching inspected tabs or focusing a seat Then inspection stays local and seat focus uses that seat token", async () => {
    const listGlobalTerminals = vi.fn(async () => [createGlobalTerminal()]);
    const focusGlobalTerminals = vi.fn(async () => ({
      ok: true as const,
      message: "focused",
      focusedTerminalIds: ["term-main"],
    }));

    routeTestState.controller = {
      runtimeStore: {
        listAuthActors: async () => createAuthActors(),
        profileIconUrl: (reference: string) => `http://127.0.0.1:4591/media/profiles/${reference}/icon`,
        sessionIconUrl: (sessionId: string) => `http://127.0.0.1:4591/media/sessions/${sessionId}/icon`,
      },
      authSession: null,
      listGlobalTerminals,
      focusGlobalTerminals,
      loadGlobalTerminalActivity: vi.fn(async () => ({
        items: [createTerminalActivityItem()],
        hasMore: false,
        nextBefore: null,
      })),
      listGlobalTerminalGrants: vi.fn(async () => [createGlobalTerminalGrant()]),
      createGlobalTerminal: vi.fn(async () => ({ ok: true as const, message: "created", terminal: createGlobalTerminal() })),
      deleteGlobalTerminal: vi.fn(async () => ({ ok: true as const, message: "deleted" })),
      issueGlobalTerminalGrant: vi.fn(),
      revokeGlobalTerminalGrant: vi.fn(),
      listGlobalTerminalApprovalRequests: vi.fn(async () => []),
      approveGlobalTerminalRequest: vi.fn(async () => ({ ok: true as const })),
      denyGlobalTerminalRequest: vi.fn(async () => ({ ok: true as const })),
      readGlobalTerminal: vi.fn(async () => ({ ok: true as const })),
      writeGlobalTerminal: vi.fn(async () => ({ ok: true as const })),
    };

    const view = render(<GlobalTerminalsRoute />);
    const canvas = within(view.container);

    await canvas.findByRole("button", { name: "Inspect terminal tab" });
    fireEvent.click(canvas.getByRole("button", { name: "Inspect terminal tab" }));
    await waitFor(() => {
      expect(focusGlobalTerminals).not.toHaveBeenCalled();
    });

    fireEvent.click(canvas.getByRole("button", { name: "Focus observer seat" }));
    await waitFor(() => {
      expect(focusGlobalTerminals).toHaveBeenCalledWith({
        op: "add",
        terminalIds: ["term-main"],
        accessToken: "termtok_writer",
      });
    });
  });
});
