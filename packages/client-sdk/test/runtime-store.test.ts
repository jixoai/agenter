import { describe, expect, test } from "bun:test";

import { RuntimeStore } from "../src/runtime-store";
import type { AgenterClient, AgenterTransportEvent } from "../src/trpc-client";
import type { RuntimeSnapshot } from "../src/types";

type ReversePageResult<T> = {
  items: T[];
  nextBefore?: { beforeTimeMs: number; beforeId: number } | null;
  hasMoreBefore?: boolean;
};

const createTraceEntry = (input: {
  id: number;
  cycleId: number;
  seq?: number;
  kind?: string;
  name?: string;
  status?: "running" | "done" | "error" | "cancelled";
  startedAt?: number;
  endedAt?: number;
  attributes?: Record<string, unknown>;
}) => ({
  id: input.id,
  cycleId: input.cycleId,
  seq: input.seq ?? 1,
  traceId: `trace-${input.cycleId}`,
  spanId: `span-${input.id}`,
  parentSpanId: null,
  kind: input.kind ?? "source.collect",
  name: input.name ?? "collect_inputs",
  status: input.status ?? "done",
  startedAt: input.startedAt ?? Date.now(),
  endedAt: input.endedAt ?? input.startedAt ?? Date.now(),
  refs: [],
  links: [],
  events: [],
  attributes: input.attributes ?? {},
  outcome: input.status === "running" ? undefined : { code: (input.status ?? "done") === "error" ? "error" : "done" },
});

const createSnapshot = (
  eventId: number,
  input: {
    messageChannels?: RuntimeSnapshot["runtimes"][string]["messageChannels"];
    attention?: RuntimeSnapshot["runtimes"][string]["attention"];
    schedulerState?: RuntimeSnapshot["runtimes"][string]["schedulerState"];
  } = {},
): RuntimeSnapshot => ({
  version: 1,
  timestamp: Date.now(),
  lastEventId: eventId,
  sessions: [
    {
      id: "i-1",
      name: "workspace",
      cwd: process.cwd(),
      avatar: "tester-bot",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "running",
      storageState: "active",
      sessionRoot: "/tmp/sessions/i-1",
      storeTarget: "global",
    },
  ],
  runtimes: {
    "i-1": {
      sessionId: "i-1",
      started: true,
      activityState: "idle",
      schedulerPhase: "waiting_commits",
      stage: "idle",
      focusedTerminalId: "main",
      focusedTerminalIds: ["main"],
      chatMessages: [],
      messageChannels: input.messageChannels,
      terminalSnapshots: {
        main: {
          seq: 0,
          timestamp: Date.now(),
          cols: 80,
          rows: 24,
          lines: Array.from({ length: 24 }, () => ""),
          cursor: { x: 0, y: 0 },
        },
      },
      terminalReads: {},
      tasks: [],
      schedulerState: input.schedulerState ?? null,
      attention: input.attention,
      schedulerSignals: {
        user: { version: 0, timestamp: null },
        terminal: { version: 0, timestamp: null },
        task: { version: 0, timestamp: null },
        attention: { version: 0, timestamp: null },
      },
      apiCallRecording: {
        enabled: false,
        refCount: 0,
      },
      terminals: [
        {
          terminalId: "main",
          running: true,
          status: "IDLE",
          seq: 0,
          cwd: process.cwd(),
        },
      ],
      modelCapabilities: {
        streaming: true,
        tools: true,
        imageInput: false,
        nativeCompact: false,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      },
      activeCycle: null,
    },
  },
});

const emptyNotificationSnapshot = () => ({
  items: [],
  unreadBySession: {},
  unreadByChat: {},
  unreadByTerminal: {},
});

const createMockClient = (input: {
  snapshotQuery: () => Promise<RuntimeSnapshot>;
  onSubscribe?: (handlers: { onData?: (event: unknown) => void; onError?: () => void }) => void;
  onTransportSubscribe?: (listener: (event: AgenterTransportEvent) => void) => void;
  onClose?: () => void;
  apiCallsSubscribe?: (
    payload: { sessionId: string; afterId: number },
    handlers: { onData?: (payload: unknown) => void; onError?: () => void },
  ) => { unsubscribe: () => void };
  createSessionResult?: RuntimeSnapshot["sessions"][number];
  workspaceRecentQuery?: () => Promise<{ items: string[] }>;
  profileServiceQuery?: () => Promise<{ endpoint: string }>;
  workspaceListAllQuery?: () => Promise<{
    items: Array<{
      path: string;
      favorite: boolean;
      group: string;
      missing: boolean;
      counts: { all: number; running: number; stopped: number; archive: number };
      lastSessionActivityAt?: string;
    }>;
  }>;
  workspaceCleanMissingMutate?: () => Promise<{ removed: string[] }>;
  notificationSnapshotQuery?: () => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      sourceType: "chat" | "terminal";
      sourceId: string;
      chatId?: string;
      terminalId?: string;
      workspacePath: string;
      sessionName: string;
      messageId?: string;
      messageSeq?: number;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
    unreadByChat: Record<string, Record<string, number>>;
    unreadByTerminal: Record<string, Record<string, number>>;
  }>;
  setChatVisibilityMutate?: (input: {
    sessionId: string;
    chatId?: string;
    visible: boolean;
    focused: boolean;
  }) => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      sourceType: "chat" | "terminal";
      sourceId: string;
      chatId?: string;
      terminalId?: string;
      workspacePath: string;
      sessionName: string;
      messageId?: string;
      messageSeq?: number;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
    unreadByChat: Record<string, Record<string, number>>;
    unreadByTerminal: Record<string, Record<string, number>>;
  }>;
  setTerminalVisibilityMutate?: (input: {
    sessionId: string;
    terminalId?: string;
    visible: boolean;
    focused: boolean;
  }) => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      sourceType: "chat" | "terminal";
      sourceId: string;
      chatId?: string;
      terminalId?: string;
      workspacePath: string;
      sessionName: string;
      messageId?: string;
      messageSeq?: number;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
    unreadByChat: Record<string, Record<string, number>>;
    unreadByTerminal: Record<string, Record<string, number>>;
  }>;
  consumeNotificationsMutate?: (input: {
    sessionId: string;
    chatId?: string;
    terminalId?: string;
    upToMessageId?: string;
  }) => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      sourceType: "chat" | "terminal";
      sourceId: string;
      chatId?: string;
      terminalId?: string;
      workspacePath: string;
      sessionName: string;
      messageId?: string;
      messageSeq?: number;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
    unreadByChat: Record<string, Record<string, number>>;
    unreadByTerminal: Record<string, Record<string, number>>;
  }>;
  listSettingsLayersQuery?: (input: { workspacePath: string }) => Promise<{
    effective: { content: string };
    layers: Array<{
      layerId: string;
      sourceId: string;
      path: string;
      exists: boolean;
      editable: boolean;
      readonlyReason?: string;
    }>;
  }>;
  readSettingsLayerQuery?: (input: { workspacePath: string; layerId: string }) => Promise<{
    layer: {
      layerId: string;
      sourceId: string;
      path: string;
      exists: boolean;
      editable: boolean;
      readonlyReason?: string;
    };
    path: string;
    content: string;
    mtimeMs: number;
  }>;
  saveSettingsLayerMutate?: (input: {
    workspacePath: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
  }) => Promise<
    | {
        ok: true;
        file: { path: string; content: string; mtimeMs: number };
        effective: { content: string };
      }
    | {
        ok: false;
        reason: "conflict";
        latest: { path: string; content: string; mtimeMs: number };
      }
    | { ok: false; reason: "readonly"; message: string }
  >;
  chatSendMutate?: (input: {
    sessionId: string;
    text: string;
    assetIds: string[];
    clientMessageId: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  chatListQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  chatCyclesQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  messageListChannelsQuery?: (input: { sessionId: string; includeArchived?: boolean }) => Promise<{ items: unknown[] }>;
  messageCreateChannelMutate?: (input: {
    sessionId: string;
    kind: "room";
    title?: string;
    focus?: boolean;
  }) => Promise<{ channel: unknown }>;
  messageFocusMutate?: (input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken: string }>;
  }) => Promise<{ items: unknown[] }>;
  messageSendMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    text: string;
    assetIds?: string[];
    clientMessageId: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  messageUpdateChannelMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
      metadata?: Record<string, unknown>;
    };
  }) => Promise<{ channel: unknown }>;
  messageListChannelGrantsQuery?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
  }) => Promise<{ items: unknown[] }>;
  messageIssueChannelGrantMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId?: string;
  }) => Promise<{ grant: unknown }>;
  messageRevokeChannelGrantMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    grantId: string;
  }) => Promise<{ ok: boolean }>;
  messageDeleteChannelMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    archivedBy?: string;
  }) => Promise<{ channel: unknown }>;
  messageGlobalListQuery?: (input: { includeArchived?: boolean }) => Promise<{ items: unknown[] }>;
  messageGlobalCreateMutate?: (input: {
    chatId?: string;
    kind: "room";
    title?: string;
    participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }) => Promise<{ channel: unknown }>;
  messageGlobalFocusMutate?: (input: {
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken?: string }>;
  }) => Promise<{ ok: boolean; message: string; focusedChatIds: string[] }>;
  messageGlobalSnapshotQuery?: (input: {
    chatId: string;
    accessToken?: string;
    limit?: number;
  }) => Promise<{
    channel: unknown;
    items: unknown[];
    nextBefore: { beforeTimeMs: number; beforeId: number } | null;
    hasMoreBefore: boolean;
    headVersion: string;
  }>;
  messageGlobalPageQuery?: (input: {
    chatId: string;
    accessToken?: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  messageGlobalSendMutate?: (input: {
    chatId: string;
    accessToken?: string;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  messageGlobalUpdateMutate?: (input: {
    chatId: string;
    accessToken?: string;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
      metadata?: Record<string, unknown>;
      adminGroupCandidateIds?: string[];
    };
  }) => Promise<{ channel: unknown }>;
  messageGlobalListGrantsQuery?: (input: {
    chatId: string;
    accessToken?: string;
  }) => Promise<{ items: unknown[] }>;
  messageGlobalIssueGrantMutate?: (input: {
    chatId: string;
    accessToken?: string;
    role: "admin" | "member" | "readonly";
    participantId: string;
    label?: string;
    accessTokenHint?: string;
  }) => Promise<{ grant: unknown }>;
  messageGlobalRevokeGrantMutate?: (input: {
    chatId: string;
    accessToken?: string;
    grantId: string;
  }) => Promise<{ ok: boolean }>;
  messageGlobalDeleteMutate?: (input: {
    chatId: string;
    accessToken?: string;
    archivedBy?: string;
  }) => Promise<{ channel: unknown }>;
  terminalListQuery?: (input: { sessionId: string }) => Promise<{ items: unknown[] }>;
  terminalCreateMutate?: (input: {
    sessionId: string;
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: unknown;
    focus?: boolean;
  }) => Promise<{ result: unknown }>;
  terminalFocusMutate?: (input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }) => Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }>;
  terminalDeleteMutate?: (input: { sessionId: string; terminalId: string }) => Promise<{ ok: boolean; message: string }>;
  terminalActivityPageQuery?: (input: {
    sessionId: string;
    terminalId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  attentionStateQuery?: (input: { sessionId: string }) => Promise<unknown>;
  attentionQueryQuery?: (input: {
    sessionId: string;
    query?: string;
    offset?: number;
    limit?: number;
  }) => Promise<{ items: unknown[] }>;
}): AgenterClient => {
  let authToken: string | null = null;

  return {
    trpc: {
      auth: {
        service: {
          query: async () =>
            input.profileServiceQuery
              ? await input.profileServiceQuery()
              : {
                  endpoint: "http://127.0.0.1:4591",
                  authMode: "wallet_challenge_jwt",
                  rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
                  rootIdentifier: {
                    kind: "wallet_evm",
                    value: "0x0000000000000000000000000000000000000001",
                  },
                  jwtTtlSeconds: 3600,
                },
        },
        challengeStart: {
          mutate: async (payload: { authId: string }) => ({
            challengeId: crypto.randomUUID(),
            challengeText: `challenge:${payload.authId}`,
            authId: payload.authId,
            expiresAt: new Date().toISOString(),
          }),
        },
        challengeVerify: {
          mutate: async (payload: { challengeId: string; signature: string }) => ({
            token: `token:${payload.challengeId}:${payload.signature}`,
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            claims: {
              authId: "wallet_evm:0x0000000000000000000000000000000000000001",
              profileId: "profile-1",
              admin: true,
              superadmin: false,
            },
            profile: {
              profileId: "profile-1",
              identifiers: [{ kind: "wallet_evm", value: "0x0000000000000000000000000000000000000001" }],
              metadata: {},
              iconUrl: "http://127.0.0.1:4591/media/profiles/profile-1/icon",
              isVirtual: false,
            },
          }),
        },
        session: {
          query: async () => {
            if (!authToken) {
              const error = new Error("UNAUTHORIZED") as Error & { data?: { code: string } };
              error.data = { code: "UNAUTHORIZED" };
              throw error;
            }
            return {
              token: authToken,
              issuedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              claims: {
                authId: "wallet_evm:0x0000000000000000000000000000000000000001",
                profileId: "profile-1",
                admin: true,
                superadmin: false,
              },
              profile: {
                profileId: "profile-1",
                identifiers: [{ kind: "wallet_evm", value: "0x0000000000000000000000000000000000000001" }],
                metadata: {},
                iconUrl: "http://127.0.0.1:4591/media/profiles/profile-1/icon",
                isVirtual: false,
              },
            };
          },
        },
        superadminStatus: {
          query: async () => ({
            ok: true,
            claims: {
              authId: "wallet_evm:0x0000000000000000000000000000000000000001",
              profileId: "profile-1",
              admin: true,
              superadmin: true,
            },
          }),
        },
      },
      runtime: {
        snapshot: {
          query: input.snapshotQuery,
        },
        attentionState: {
          query: async (payload: { sessionId: string }) =>
            input.attentionStateQuery
              ? await input.attentionStateQuery(payload)
              : { snapshot: { contexts: [] }, active: [], cycleFrames: [], egress: [] },
        },
        attentionQuery: {
          query: async (payload: {
            sessionId: string;
            query?: string;
            offset?: number;
            limit?: number;
          }) => (input.attentionQueryQuery ? await input.attentionQueryQuery(payload) : { items: [] }),
        },
        events: {
          subscribe: (_payload: unknown, handlers: { onData?: (event: unknown) => void; onError?: () => void }) => {
            input.onSubscribe?.({
              onData: handlers.onData,
              onError: handlers.onError,
            });
            return {
              unsubscribe: () => {},
            };
          },
        },
        schedulerLogs: {
          query: async () => ({ items: [], nextBefore: null, hasMoreBefore: false }),
        },
        observabilityTraces: {
          query: async () => ({ items: [], nextBefore: null, hasMoreBefore: false }),
        },
        modelCallsPage: {
          query: async () => ({ items: [], nextBefore: null, hasMoreBefore: false }),
        },
        apiCallsPage: {
          query: async () => ({ items: [], nextBefore: null, hasMoreBefore: false }),
        },
        terminalActivityPage: {
          query: async (payload: {
            sessionId: string;
            terminalId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.terminalActivityPageQuery
              ? await input.terminalActivityPageQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        apiCalls: {
          subscribe: (
            payload: { sessionId: string; afterId: number },
            handlers: { onData?: (payload: unknown) => void; onError?: () => void },
          ) =>
            input.apiCallsSubscribe
              ? input.apiCallsSubscribe(payload, handlers)
              : {
                  unsubscribe: () => {},
                },
        },
      },
      session: {
        create: {
          mutate: async () => ({
            session: input.createSessionResult ?? createSnapshot(0).sessions[0],
          }),
        },
        start: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        stop: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        abort: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        archive: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        restore: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        delete: { mutate: async () => ({}) },
      },
      chat: {
        send: {
          mutate: async (payload: { sessionId: string; text: string; assetIds: string[]; clientMessageId: string }) =>
            input.chatSendMutate ? await input.chatSendMutate(payload) : { ok: true },
        },
        list: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.chatListQuery
              ? await input.chatListQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        cycles: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.chatCyclesQuery
              ? await input.chatCyclesQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
      },
      message: {
        listChannels: {
          query: async (payload: { sessionId: string; includeArchived?: boolean }) =>
            input.messageListChannelsQuery ? await input.messageListChannelsQuery(payload) : { items: [] },
        },
        createChannel: {
          mutate: async (payload: { sessionId: string; kind: "room"; title?: string; focus?: boolean }) =>
            input.messageCreateChannelMutate ? await input.messageCreateChannelMutate(payload) : { channel: null },
        },
        focus: {
          mutate: async (payload: {
            sessionId: string;
            op: "add" | "remove" | "replace" | "clear";
            channels: Array<{ chatId: string; accessToken: string }>;
          }) => (input.messageFocusMutate ? await input.messageFocusMutate(payload) : { items: [] }),
        },
        send: {
          mutate: async (payload: {
            sessionId: string;
            chatId: string;
            accessToken: string;
            text: string;
            assetIds?: string[];
            clientMessageId: string;
          }) => (input.messageSendMutate ? await input.messageSendMutate(payload) : { ok: true }),
        },
        updateChannel: {
          mutate: async (payload: {
            sessionId: string;
            chatId: string;
            accessToken: string;
            patch: {
              title?: string;
              participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
              metadata?: Record<string, unknown>;
            };
          }) =>
            input.messageUpdateChannelMutate ? await input.messageUpdateChannelMutate(payload) : { channel: null },
        },
        listChannelGrants: {
          query: async (payload: { sessionId: string; chatId: string; accessToken: string }) =>
            input.messageListChannelGrantsQuery ? await input.messageListChannelGrantsQuery(payload) : { items: [] },
        },
        issueChannelGrant: {
          mutate: async (payload: {
            sessionId: string;
            chatId: string;
            accessToken: string;
            role: "admin" | "member" | "readonly";
            label?: string;
            participantId?: string;
          }) =>
            input.messageIssueChannelGrantMutate
              ? await input.messageIssueChannelGrantMutate(payload)
              : { grant: null },
        },
        revokeChannelGrant: {
          mutate: async (payload: { sessionId: string; chatId: string; accessToken: string; grantId: string }) =>
            input.messageRevokeChannelGrantMutate ? await input.messageRevokeChannelGrantMutate(payload) : { ok: true },
        },
        deleteChannel: {
          mutate: async (payload: { sessionId: string; chatId: string; accessToken: string; archivedBy?: string }) =>
            input.messageDeleteChannelMutate ? await input.messageDeleteChannelMutate(payload) : { channel: null },
        },
        globalList: {
          query: async (payload: { includeArchived?: boolean }) =>
            input.messageGlobalListQuery ? await input.messageGlobalListQuery(payload) : { items: [] },
        },
        globalCreate: {
          mutate: async (payload: {
            chatId?: string;
            kind: "room";
            title?: string;
            participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
            metadata?: Record<string, unknown>;
            adminToken?: string;
            focus?: boolean;
          }) => (input.messageGlobalCreateMutate ? await input.messageGlobalCreateMutate(payload) : { channel: null }),
        },
        globalFocus: {
          mutate: async (payload: {
            op: "add" | "remove" | "replace" | "clear";
            channels: Array<{ chatId: string; accessToken?: string }>;
          }) =>
            input.messageGlobalFocusMutate
              ? await input.messageGlobalFocusMutate(payload)
              : { ok: true, message: "ok", focusedChatIds: payload.channels.map((channel) => channel.chatId) },
        },
        globalSnapshot: {
          query: async (payload: { chatId: string; accessToken?: string; limit?: number }) =>
            input.messageGlobalSnapshotQuery
              ? await input.messageGlobalSnapshotQuery(payload)
              : {
                  channel: null,
                  items: [],
                  nextBefore: null,
                  hasMoreBefore: false,
                  headVersion: "0",
                },
        },
        globalPage: {
          query: async (payload: {
            chatId: string;
            accessToken?: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.messageGlobalPageQuery
              ? await input.messageGlobalPageQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        globalSend: {
          mutate: async (payload: {
            chatId: string;
            accessToken?: string;
            text: string;
            assetIds?: string[];
            clientMessageId?: string;
          }) => (input.messageGlobalSendMutate ? await input.messageGlobalSendMutate(payload) : { ok: true }),
        },
        globalUpdate: {
          mutate: async (payload: {
            chatId: string;
            accessToken?: string;
            patch: {
              title?: string;
              participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
              metadata?: Record<string, unknown>;
              adminGroupCandidateIds?: string[];
            };
          }) => (input.messageGlobalUpdateMutate ? await input.messageGlobalUpdateMutate(payload) : { channel: null }),
        },
        globalListGrants: {
          query: async (payload: { chatId: string; accessToken?: string }) =>
            input.messageGlobalListGrantsQuery ? await input.messageGlobalListGrantsQuery(payload) : { items: [] },
        },
        globalIssueGrant: {
          mutate: async (payload: {
            chatId: string;
            accessToken?: string;
            role: "admin" | "member" | "readonly";
            participantId: string;
            label?: string;
            accessTokenHint?: string;
          }) =>
            input.messageGlobalIssueGrantMutate
              ? await input.messageGlobalIssueGrantMutate(payload)
              : { grant: null },
        },
        globalRevokeGrant: {
          mutate: async (payload: { chatId: string; accessToken?: string; grantId: string }) =>
            input.messageGlobalRevokeGrantMutate ? await input.messageGlobalRevokeGrantMutate(payload) : { ok: true },
        },
        globalDelete: {
          mutate: async (payload: { chatId: string; accessToken?: string; archivedBy?: string }) =>
            input.messageGlobalDeleteMutate ? await input.messageGlobalDeleteMutate(payload) : { channel: null },
        },
      },
      terminal: {
        list: {
          query: async (payload: { sessionId: string }) =>
            input.terminalListQuery ? await input.terminalListQuery(payload) : { items: [] },
        },
        create: {
          mutate: async (payload: {
            sessionId: string;
            terminalId?: string;
            processKind?: string;
            command?: string[];
            cwd?: string;
            profile?: unknown;
            focus?: boolean;
          }) => (input.terminalCreateMutate ? await input.terminalCreateMutate(payload) : { result: { ok: true, message: "ok" } }),
        },
        focus: {
          mutate: async (payload: {
            sessionId: string;
            op: "add" | "remove" | "replace" | "clear";
            terminalIds: string[];
          }) =>
            input.terminalFocusMutate
              ? await input.terminalFocusMutate(payload)
              : { ok: true, message: "ok", focusedTerminalIds: payload.terminalIds },
        },
        delete: {
          mutate: async (payload: { sessionId: string; terminalId: string }) =>
            input.terminalDeleteMutate ? await input.terminalDeleteMutate(payload) : { ok: true, message: "ok" },
        },
      },
      draft: {
        resolve: {
          query: async () => ({
            cwd: process.cwd(),
            provider: { providerId: "default", apiStandard: "openai-responses", vendor: "openai", model: "test" },
            modelCapabilities: {
              streaming: true,
              tools: true,
              imageInput: false,
              nativeCompact: true,
              summarizeFallback: true,
              fileUpload: false,
              mcpCatalog: false,
            },
          }),
        },
      },
      settings: {
        read: {
          query: async () => ({
            path: "settings.json",
            content: "{}",
            mtimeMs: Date.now(),
          }),
        },
        save: {
          mutate: async () => ({
            ok: true as const,
            file: {
              path: "settings.json",
              content: "{}",
              mtimeMs: Date.now(),
            },
          }),
        },
        layers: {
          list: {
            query: async (payload: { workspacePath: string }) =>
              input.listSettingsLayersQuery
                ? await input.listSettingsLayersQuery(payload)
                : {
                    effective: { content: "{}" },
                    layers: [],
                  },
          },
          read: {
            query: async (payload: { workspacePath: string; layerId: string }) =>
              input.readSettingsLayerQuery
                ? await input.readSettingsLayerQuery(payload)
                : {
                    layer: {
                      layerId: payload.layerId,
                      sourceId: "project",
                      path: `${payload.workspacePath}/.agenter/settings.json`,
                      exists: true,
                      editable: true,
                    },
                    path: `${payload.workspacePath}/.agenter/settings.json`,
                    content: "{}",
                    mtimeMs: Date.now(),
                  },
          },
          save: {
            mutate: async (payload: {
              workspacePath: string;
              layerId: string;
              content: string;
              baseMtimeMs: number;
            }) =>
              input.saveSettingsLayerMutate
                ? await input.saveSettingsLayerMutate(payload)
                : {
                    ok: true as const,
                    file: {
                      path: `${payload.workspacePath}/.agenter/settings.json`,
                      content: payload.content,
                      mtimeMs: payload.baseMtimeMs + 1,
                    },
                    effective: {
                      content: payload.content,
                    },
                  },
          },
        },
      },
      profile: {
        service: {
          query: async () =>
            input.profileServiceQuery
              ? await input.profileServiceQuery()
              : {
                  endpoint: "http://127.0.0.1:4591",
                  authMode: "wallet_challenge_jwt",
                  rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
                  rootIdentifier: {
                    kind: "wallet_evm",
                    value: "0x0000000000000000000000000000000000000001",
                  },
                  jwtTtlSeconds: 3600,
                },
        },
        list: {
          query: async () => ({ items: [] }),
        },
        get: {
          query: async () => ({
            profileId: null,
            identifiers: [],
            metadata: {},
            iconUrl: "http://127.0.0.1:4591/media/profiles/temp%3Ademo/icon",
            isVirtual: true,
          }),
        },
        update: {
          mutate: async (payload: {
            reference: string;
            patch: Record<string, unknown>;
          }) => ({
            profileId: payload.reference,
            identifiers: [],
            metadata: payload.patch,
            iconUrl: `http://127.0.0.1:4591/media/profiles/${encodeURIComponent(payload.reference)}/icon`,
            isVirtual: false,
          }),
        },
        auth: {
          emailStart: {
            mutate: async (payload: { email: string }) => ({
              challengeId: `challenge:${payload.email}`,
              delivery: "console",
              expiresAt: new Date().toISOString(),
            }),
          },
          emailVerify: {
            mutate: async (payload: { email: string; code: string; token?: string }) => ({
              profile: {
                profileId: payload.email,
                identifiers: [{ kind: "email", value: payload.email }],
                metadata: {},
                iconUrl: `http://127.0.0.1:4591/media/profiles/${encodeURIComponent(payload.email)}/icon`,
                isVirtual: false,
              },
              registrationTicket: `ticket:${payload.code}`,
              expiresAt: new Date().toISOString(),
              registrationUrl: `http://127.0.0.1:4591/auth/webauthn/register?ticket=${encodeURIComponent(`ticket:${payload.code}`)}`,
            }),
          },
        },
      },
      notification: {
        snapshot: {
          query: async () =>
            input.notificationSnapshotQuery
              ? await input.notificationSnapshotQuery()
              : emptyNotificationSnapshot(),
        },
        setChatVisibility: {
          mutate: async (payload: { sessionId: string; visible: boolean; focused: boolean }) =>
            input.setChatVisibilityMutate
              ? await input.setChatVisibilityMutate(payload)
              : emptyNotificationSnapshot(),
        },
        setTerminalVisibility: {
          mutate: async (payload: { sessionId: string; terminalId?: string; visible: boolean; focused: boolean }) =>
            input.setTerminalVisibilityMutate
              ? await input.setTerminalVisibilityMutate(payload)
              : emptyNotificationSnapshot(),
        },
        consume: {
          mutate: async (payload: { sessionId: string; chatId?: string; terminalId?: string; upToMessageId?: string }) =>
            input.consumeNotificationsMutate
              ? await input.consumeNotificationsMutate(payload)
              : emptyNotificationSnapshot(),
        },
      },
      task: {
        list: { query: async () => ({ ok: true, tasks: [] }) },
        triggerManual: { mutate: async () => ({ ok: true }) },
        emitEvent: { mutate: async () => ({ ok: true }) },
      },
      workspace: {
        recent: {
          query: async () => (input.workspaceRecentQuery ? input.workspaceRecentQuery() : { items: [process.cwd()] }),
        },
        listAll: { query: async () => (input.workspaceListAllQuery ? input.workspaceListAllQuery() : { items: [] }) },
        listSessions: {
          query: async () => ({ items: [], nextCursor: null, counts: { all: 0, running: 0, stopped: 0, archive: 0 } }),
        },
        searchPaths: {
          query: async () => ({ items: [] }),
        },
        toggleFavorite: { mutate: async () => ({ item: null }) },
        toggleSessionFavorite: { mutate: async () => ({ sessionId: "i-1", favorite: true }) },
        delete: { mutate: async () => ({ removed: true }) },
        cleanMissing: {
          mutate: async () =>
            input.workspaceCleanMissingMutate ? input.workspaceCleanMissingMutate() : { removed: [] },
        },
      },
      fs: {
        listDirectories: { query: async () => ({ items: [] }) },
        validateDirectory: { query: async () => ({ ok: true, path: process.cwd() }) },
      },
    } as unknown as AgenterClient["trpc"],
    wsUrl: "ws://127.0.0.1:3000/trpc",
    httpUrl: "http://127.0.0.1:3000",
    setAuthToken: (token) => {
      const normalized = token?.trim() ?? "";
      authToken = normalized.length > 0 ? normalized : null;
    },
    getAuthToken: () => authToken,
    subscribeTransport: (listener: (event: AgenterTransportEvent) => void) => {
      input.onTransportSubscribe?.(listener);
      return () => {};
    },
    close: () => {
      input.onClose?.();
    },
  };
};

const waitFor = async (predicate: () => boolean, timeoutMs = 4_000): Promise<void> => {
  const startAt = Date.now();
  while (Date.now() - startAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("timeout waiting for condition");
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const withBrowserOnlineState = async (
  initialOnline: boolean,
  callback: (controls: { setOnline: (online: boolean) => void }) => Promise<void>,
): Promise<void> => {
  const eventTarget = new EventTarget();
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const navigatorValue = { onLine: initialOnline };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorValue,
  });

  try {
    await callback({
      setOnline: (online: boolean) => {
        navigatorValue.onLine = online;
        eventTarget.dispatchEvent(new Event(online ? "online" : "offline"));
      },
    });
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
};

const withAnimationFrameWindow = async (
  callback: (controls: { flushFrame: (time?: number) => void }) => Promise<void>,
): Promise<void> => {
  const eventTarget = new EventTarget();
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        const handle = nextHandle++;
        frameCallbacks.set(handle, callback);
        return handle;
      },
      cancelAnimationFrame: (handle: number) => {
        frameCallbacks.delete(handle);
      },
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });

  try {
    await callback({
      flushFrame: (time = 0) => {
        const callbacks = [...frameCallbacks.values()];
        frameCallbacks.clear();
        for (const callback of callbacks) {
          callback(time);
        }
      },
    });
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
};

describe("Feature: runtime store synchronization", () => {
  test("Scenario: Given browser-frame batching When hot runtime events burst before the next frame Then listeners observe one coalesced publication", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(10),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });

    await withAnimationFrameWindow(async ({ flushFrame }) => {
      const store = new RuntimeStore(client);
      let publishCount = 0;
      store.subscribe(() => {
        publishCount += 1;
      });

      await store.connect();
      expect(publishCount).toBe(0);

      flushFrame();
      expect(publishCount).toBe(1);

      onData?.({
        version: 1,
        eventId: 11,
        timestamp: Date.now(),
        type: "runtime.phase",
        sessionId: "i-1",
        payload: { phase: "collecting_inputs" },
      });
      onData?.({
        version: 1,
        eventId: 12,
        timestamp: Date.now(),
        type: "runtime.observability.trace",
        sessionId: "i-1",
        payload: {
          entry: createTraceEntry({
            id: 12,
            cycleId: 1,
            attributes: { inputs: 2 },
          }),
        },
      });

      expect(publishCount).toBe(1);

      flushFrame();
      expect(publishCount).toBe(2);
      expect(store.getState().runtimes["i-1"]?.schedulerPhase).toBe("collecting_inputs");
      expect(store.getState().observabilityTracesBySession["i-1"]?.length).toBe(1);

      store.disconnect();
    });
  });

  test("Scenario: Given subscription events When applying updates Then state stays ordered and deduped", async () => {
    let onData: ((event: unknown) => void) | undefined;
    let onError: (() => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(10),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
        onError = handlers.onError;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    expect(store.getState().connected).toBe(true);
    expect(store.getState().lastEventId).toBe(10);
    expect(store.getState().recentWorkspaces).toHaveLength(1);
    expect(store.getState().activityBySession["i-1"]).toBe("idle");
    expect(store.getState().terminalSnapshotsBySession["i-1"]?.main?.seq).toBe(0);

    onData?.({
      version: 1,
      eventId: 11,
      timestamp: Date.now(),
      type: "chat.message",
      sessionId: "i-1",
      payload: {
        message: {
          id: "m-1",
          role: "assistant",
          content: "hello",
          timestamp: Date.now(),
        },
      },
    });
    expect(store.getState().chatsBySession["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 9,
      timestamp: Date.now(),
      type: "chat.message",
      sessionId: "i-1",
      payload: {
        message: {
          id: "ignored",
          role: "assistant",
          content: "ignored",
          timestamp: Date.now(),
        },
      },
    });
    expect(store.getState().chatsBySession["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 12,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "calling_model" },
    });
    expect(store.getState().runtimes["i-1"]?.schedulerPhase).toBe("calling_model");
    expect(store.getState().activityBySession["i-1"]).toBe("active");

    onData?.({
      version: 1,
      eventId: 13,
      timestamp: Date.now(),
      type: "terminal.snapshot",
      sessionId: "i-1",
      payload: {
        terminalId: "main",
        snapshot: {
          seq: 2,
          timestamp: Date.now(),
          cols: 80,
          rows: 24,
          lines: ["hello"],
          cursor: { x: 5, y: 0 },
        },
      },
    });
    expect(store.getState().terminalSnapshotsBySession["i-1"]?.main?.lines[0]).toBe("hello");

    onData?.({
      version: 1,
      eventId: 14,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "waiting_commits" },
    });
    expect(store.getState().activityBySession["i-1"]).toBe("idle");

    onError?.();
    expect(store.getState().connected).toBe(false);
    expect(store.getState().connectionStatus).toBe("reconnecting");
    store.disconnect();
  });

  test("Scenario: Given unchanged attention data When non-attention runtime events arrive Then the attention reference stays stable", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const attention = {
      snapshot: {
        contexts: [
          {
            contextId: "ctx-chat-main",
            owner: "tester-bot",
            content: "current notebook",
            scoreMap: { abcd12: 100 },
            headCommitId: "commit-1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            commitCount: 1,
            commitsTruncated: false,
            commits: [
              {
                commitId: "commit-1",
                contextId: "ctx-chat-main",
                parentCommitIds: [],
                meta: {
                  author: "tester-bot",
                  source: "message",
                  createdAt: new Date().toISOString(),
                },
                scores: { abcd12: 100 },
                summary: "User asked for a reply",
                change: {
                  type: "update" as const,
                  value: "current notebook",
                  format: "text/plain",
                },
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
      },
      active: [],
      cycleFrames: [],
      hooks: [],
    } satisfies NonNullable<RuntimeSnapshot["runtimes"][string]["attention"]>;

    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(10, { attention }),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const initialAttention = store.getState().attentionBySession?.["i-1"];
    expect(initialAttention).toBeDefined();

    onData?.({
      version: 1,
      eventId: 11,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "collecting_inputs" },
    });

    expect(store.getState().attentionBySession?.["i-1"]).toBe(initialAttention);

    store.disconnect();
  });

  test("Scenario: Given snapshot and focused-terminal events When multiple focused terminals are published Then the ordered focus set stays primary", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const snapshot = createSnapshot(40);
    snapshot.runtimes["i-1"] = {
      ...snapshot.runtimes["i-1"],
      focusedTerminalId: "legacy-main",
      focusedTerminalIds: ["aux", "main", "aux"],
    };

    const client = createMockClient({
      snapshotQuery: async () => snapshot,
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    expect(store.getState().runtimes["i-1"]?.focusedTerminalIds).toEqual(["aux", "main"]);
    expect(store.getState().runtimes["i-1"]?.focusedTerminalId).toBe("aux");

    onData?.({
      version: 1,
      eventId: 41,
      timestamp: Date.now(),
      type: "runtime.focusedTerminal",
      sessionId: "i-1",
      payload: {
        terminalId: "stale-single",
        terminalIds: ["main", "aux", "main"],
      },
    });

    expect(store.getState().runtimes["i-1"]?.focusedTerminalIds).toEqual(["main", "aux"]);
    expect(store.getState().runtimes["i-1"]?.focusedTerminalId).toBe("main");
    store.disconnect();
  });

  test("Scenario: Given terminal read events When representation metadata is published Then the runtime store preserves it without inference", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(60),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    onData?.({
      version: 1,
      eventId: 61,
      timestamp: Date.now(),
      type: "terminal.read",
      sessionId: "i-1",
      payload: {
        terminalId: "main",
        result: {
          kind: "terminal-diff",
          representation: "diff",
          terminalId: "main",
          fromHash: "10",
          toHash: "11",
          diff: "echo ready",
          bytes: 10,
          status: "IDLE",
        },
      },
    });

    expect(store.getState().terminalReadsBySession["i-1"]?.main?.representation).toBe("diff");
    expect(store.getState().runtimes["i-1"]?.terminalReads.main?.kind).toBe("terminal-diff");
    store.disconnect();
  });

  test("Scenario: Given first snapshot request fails When reconnecting Then store recovers automatically", async () => {
    let callCount = 0;
    const client = createMockClient({
      snapshotQuery: async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error("network-error");
        }
        return createSnapshot(20);
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await waitFor(() => store.getState().connected);
    expect(store.getState().lastEventId).toBe(20);
    expect(store.getState().connectionStatus).toBe("connected");
    store.disconnect();
  });

  test("Scenario: Given secondary chrome queries are slow When connect succeeds Then runtime state hydrates before workspace and notification chrome", async () => {
    const workspacesDeferred = createDeferred<{
      items: Array<{
        path: string;
        favorite: boolean;
        group: string;
        missing: boolean;
        counts: { all: number; running: number; stopped: number; archive: number };
        lastSessionActivityAt?: string;
      }>;
    }>();
    const notificationsDeferred = createDeferred<{
      items: Array<{
        id: string;
        sessionId: string;
        sourceType: "chat" | "terminal";
        sourceId: string;
        chatId?: string;
        terminalId?: string;
        workspacePath: string;
        sessionName: string;
        messageId?: string;
        messageSeq?: number;
        content: string;
        timestamp: number;
      }>;
      unreadBySession: Record<string, number>;
      unreadByChat: Record<string, Record<string, number>>;
      unreadByTerminal: Record<string, Record<string, number>>;
    }>();
    const client = createMockClient({
      snapshotQuery: async () =>
        createSnapshot(26, {
          messageChannels: [
            {
              chatId: "room-main",
              kind: "room",
              title: "Main room",
              owner: "tester-bot",
              participants: [
                { id: "avatar:tester-bot", label: "tester-bot", role: "avatar" },
                { id: "user", label: "User", role: "user" },
              ],
              createdAt: 1,
              updatedAt: 2,
              focused: true,
              accessRole: "admin",
              accessToken: "msgtok_roommain",
              transportUrl: "ws://127.0.0.1:7777/room/room-main?token=msgtok_roommain",
            },
          ],
        }),
      workspaceListAllQuery: async () => await workspacesDeferred.promise,
      notificationSnapshotQuery: async () => await notificationsDeferred.promise,
    });
    const store = new RuntimeStore(client);

    await store.connect();

    expect(store.getState().connectionStatus).toBe("connected");
    expect(store.getState().messageChannelsBySession["i-1"]?.data).toHaveLength(1);
    expect(store.getState().workspaces).toEqual([]);
    expect(store.getState().notifications).toEqual([]);

    workspacesDeferred.resolve({
      items: [
        {
          path: process.cwd(),
          favorite: true,
          group: "default",
          missing: false,
          counts: { all: 1, running: 1, stopped: 0, archive: 0 },
        },
      ],
    });
    notificationsDeferred.resolve({
      items: [
        {
          id: "notif-1",
          sessionId: "i-1",
          sourceType: "chat",
          sourceId: "chat-main",
          chatId: "chat-main",
          workspacePath: process.cwd(),
          sessionName: "workspace",
          messageId: "msg-1",
          messageSeq: 1,
          content: "reply pending",
          timestamp: Date.now(),
        },
      ],
      unreadBySession: { "i-1": 1 },
      unreadByChat: { "i-1": { "chat-main": 1 } },
      unreadByTerminal: {},
    });

    await waitFor(() => store.getState().workspaces.length === 1 && store.getState().notifications.length === 1);

    expect(store.getState().unreadBySession["i-1"]).toBe(1);
    store.disconnect();
  });

  test("Scenario: Given browser goes offline When runtime store is connected Then connectionStatus becomes offline immediately", async () => {
    await withBrowserOnlineState(true, async ({ setOnline }) => {
      const client = createMockClient({
        snapshotQuery: async () => createSnapshot(25),
      });
      const store = new RuntimeStore(client);

      await store.connect();
      expect(store.getState().connectionStatus).toBe("connected");

      setOnline(false);

      expect(store.getState().connected).toBe(false);
      expect(store.getState().connectionStatus).toBe("offline");
      store.disconnect();
    });
  });

  test("Scenario: Given retained API-call streams When reconnect succeeds Then the runtime restores them from the saved cursor without duplicates", async () => {
    let transportListener: ((event: AgenterTransportEvent) => void) | undefined;
    const apiCallSubscriptions: Array<{ sessionId: string; afterId: number }> = [];
    const apiCallHandlers: Array<{ onData?: (payload: unknown) => void; onError?: () => void }> = [];
    let snapshotCallCount = 0;

    const client = createMockClient({
      snapshotQuery: async () => {
        snapshotCallCount += 1;
        return createSnapshot(snapshotCallCount === 1 ? 30 : 31);
      },
      onTransportSubscribe: (listener) => {
        transportListener = listener;
      },
      apiCallsSubscribe: (
        payload: { sessionId: string; afterId: number },
        handlers: { onData?: (payload: unknown) => void; onError?: () => void },
      ) => {
        apiCallSubscriptions.push(payload);
        apiCallHandlers.push(handlers);
        return {
          unsubscribe: () => {},
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const release = store.retainApiCallStream("i-1");
    expect(apiCallSubscriptions).toEqual([{ sessionId: "i-1", afterId: 0 }]);

    apiCallHandlers[0]?.onData?.({
      type: "apiCall",
      payload: {
        id: 5,
        modelCallId: 1,
        createdAt: Date.now(),
        request: { prompt: "hello" },
        response: { output: "world" },
      },
    });
    expect(store.getState().apiCallsBySession["i-1"]?.map((entry) => entry.id)).toEqual([5]);

    transportListener?.({ type: "close" });
    expect(store.getState().connectionStatus).toBe("reconnecting");

    transportListener?.({ type: "open" });

    await waitFor(() => apiCallSubscriptions.length === 2);
    expect(apiCallSubscriptions[1]).toEqual({ sessionId: "i-1", afterId: 5 });
    await waitFor(() => store.getState().connectionStatus === "connected");

    apiCallHandlers[1]?.onData?.({
      type: "apiCall",
      payload: {
        id: 5,
        modelCallId: 1,
        createdAt: Date.now(),
        request: { prompt: "hello" },
        response: { output: "world" },
      },
    });
    apiCallHandlers[1]?.onData?.({
      type: "apiCall",
      payload: {
        id: 6,
        modelCallId: 2,
        createdAt: Date.now(),
        request: { prompt: "next" },
        response: { output: "reply" },
      },
    });

    expect(store.getState().apiCallsBySession["i-1"]?.map((entry) => entry.id)).toEqual([5, 6]);
    release();
    store.disconnect();
  });

  test("Scenario: Given createSession call succeeds When events have not arrived yet Then local state is updated optimistically", async () => {
    const nowIso = new Date().toISOString();
    const newSession = {
      id: "i-2",
      name: "workspace-2",
      cwd: process.cwd(),
      avatar: "tester-bot",
      createdAt: nowIso,
      updatedAt: nowIso,
      status: "running" as const,
      storageState: "active" as const,
      sessionRoot: "/tmp/sessions/i-2",
      storeTarget: "global" as const,
    };
    const client = createMockClient({
      snapshotQuery: async () => ({
        ...createSnapshot(30),
        sessions: [],
        runtimes: {},
      }),
      createSessionResult: newSession,
    });
    const store = new RuntimeStore(client);

    await store.connect();
    expect(store.getState().sessions).toHaveLength(0);

    const created = await store.createSession({ cwd: process.cwd(), autoStart: true });
    expect(created.id).toBe("i-2");
    expect(store.getState().sessions.some((session) => session.id === "i-2")).toBe(true);
    expect(store.getState().runtimes["i-2"]).toBeDefined();
    expect(store.getState().chatsBySession["i-2"]).toEqual([]);

    store.disconnect();
  });

  test("Scenario: Given high-volume loopbus traces When streaming updates Then memory keeps only LRU 100 items", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(40),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);
    await store.connect();

    for (let index = 0; index < 160; index += 1) {
      const eventId = 41 + index;
      onData?.({
        version: 1,
        eventId,
        timestamp: Date.now(),
        type: "runtime.observability.trace",
        sessionId: "i-1",
        payload: {
          entry: createTraceEntry({
            id: eventId,
            cycleId: index + 1,
            kind: "model.call",
            name: "call_model",
            attributes: { inputs: 1 },
          }),
        },
      });
    }

    const traces = store.getState().observabilityTracesBySession["i-1"] ?? [];
    expect(traces.length).toBe(100);
    expect(traces[0]?.id).toBe(101);
    expect(traces.at(-1)?.id).toBe(200);
    store.disconnect();
  });

  test("Scenario: Given one model call id emits running then done When runtime events arrive Then the store merges lifecycle updates into one record", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(300),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    onData?.({
      version: 1,
      eventId: 301,
      timestamp: Date.now(),
      type: "runtime.modelCall",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 11,
          cycleId: 4,
          createdAt: 100,
          status: "running",
          provider: "deepseek/openai-chat",
          model: "deepseek-chat",
          request: { messages: [{ role: "user", content: "hello" }] },
        },
      },
    });

    onData?.({
      version: 1,
      eventId: 302,
      timestamp: Date.now(),
      type: "runtime.modelCall",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 11,
          cycleId: 4,
          createdAt: 100,
          status: "done",
          completedAt: 150,
          provider: "deepseek/openai-chat",
          model: "deepseek-chat",
          request: { messages: [{ role: "user", content: "hello" }] },
          response: { assistant: { text: "hi" } },
        },
      },
    });

    expect(store.getState().modelCallsBySession["i-1"]).toEqual([
      {
        id: 11,
        cycleId: 4,
        createdAt: 100,
        status: "done",
        completedAt: 150,
        provider: "deepseek/openai-chat",
        model: "deepseek-chat",
        request: { messages: [{ role: "user", content: "hello" }] },
        response: { assistant: { text: "hi" } },
      },
    ]);

    store.disconnect();
  });

  test("Scenario: Given model-call delta events When duplicate ids and incremental deltas arrive Then the store merges by id while preserving ordered timeline", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(320),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    onData?.({
      version: 1,
      eventId: 321,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 1,
          seq: 1,
          modelCallId: 11,
          cycleId: 4,
          timestamp: 100,
          kind: "assistant_draft",
          data: { content: "draft v1" },
        },
      },
    });
    onData?.({
      version: 1,
      eventId: 322,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 1,
          seq: 1,
          modelCallId: 11,
          cycleId: 4,
          timestamp: 101,
          kind: "assistant_draft",
          data: { content: "draft v2" },
        },
      },
    });
    onData?.({
      version: 1,
      eventId: 323,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 2,
          seq: 2,
          modelCallId: 11,
          cycleId: 4,
          timestamp: 102,
          kind: "tool_call",
          data: { toolName: "terminal_read", toolCallId: "call-1" },
        },
      },
    });

    expect(store.getState().modelCallDeltasBySession?.["i-1"]).toEqual([
      {
        id: 1,
        seq: 1,
        modelCallId: 11,
        cycleId: 4,
        timestamp: 101,
        kind: "assistant_draft",
        data: { content: "draft v2" },
      },
      {
        id: 2,
        seq: 2,
        modelCallId: 11,
        cycleId: 4,
        timestamp: 102,
        kind: "tool_call",
        data: { toolName: "terminal_read", toolCallId: "call-1" },
      },
    ]);

    store.disconnect();
  });

  test("Scenario: Given high-volume model-call deltas When runtime streams beyond limit Then the store keeps only LRU 400 items", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(340),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    for (let index = 0; index < 450; index += 1) {
      const id = index + 1;
      onData?.({
        version: 1,
        eventId: 341 + index,
        timestamp: Date.now(),
        type: "runtime.modelCall.delta",
        sessionId: "i-1",
        payload: {
          entry: {
            id,
            seq: id,
            modelCallId: 77,
            cycleId: 31,
            timestamp: 10_000 + id,
            kind: "assistant_draft",
            data: { content: `draft-${id}` },
          },
        },
      });
    }

    const deltas = store.getState().modelCallDeltasBySession?.["i-1"] ?? [];
    expect(deltas).toHaveLength(400);
    expect(deltas[0]?.id).toBe(51);
    expect(deltas.at(-1)?.id).toBe(450);

    store.disconnect();
  });

  test("Scenario: Given model-call deltas in memory When session is deleted by API or event Then delta cache is cleared", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(360),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    onData?.({
      version: 1,
      eventId: 361,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 1,
          seq: 1,
          modelCallId: 9,
          cycleId: 3,
          timestamp: 100,
          kind: "assistant_draft",
          data: { content: "draft" },
        },
      },
    });
    expect(store.getState().modelCallDeltasBySession?.["i-1"]?.length).toBe(1);

    await store.deleteSession("i-1");
    expect(store.getState().modelCallDeltasBySession?.["i-1"]).toBeUndefined();

    await store.connect();
    onData?.({
      version: 1,
      eventId: 362,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 2,
          seq: 2,
          modelCallId: 10,
          cycleId: 4,
          timestamp: 101,
          kind: "assistant_draft",
          data: { content: "draft-again" },
        },
      },
    });
    expect(store.getState().modelCallDeltasBySession?.["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 363,
      timestamp: Date.now(),
      type: "session.deleted",
      payload: { sessionId: "i-1" },
    });
    expect(store.getState().modelCallDeltasBySession?.["i-1"]).toBeUndefined();

    store.disconnect();
  });

  test("Scenario: Given missing workspaces When cleaning them Then store refreshes workspace state", async () => {
    let recentCalls = 0;
    let listAllCalls = 0;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(500),
      workspaceRecentQuery: async () => {
        recentCalls += 1;
        return { items: ["/repo/kept"] };
      },
      workspaceListAllQuery: async () => {
        listAllCalls += 1;
        return {
          items: [
            {
              path: "/repo/kept",
              favorite: false,
              group: "Other",
              missing: false,
              counts: { all: 0, running: 0, stopped: 0, archive: 0 },
            },
          ],
        };
      },
      workspaceCleanMissingMutate: async () => ({ removed: ["/repo/missing"] }),
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await waitFor(() => listAllCalls === 1 && store.getState().workspaces[0]?.path === "/repo/kept");
    const removed = await store.cleanMissingWorkspaces();

    expect(removed).toEqual(["/repo/missing"]);
    expect(store.getState().recentWorkspaces).toEqual(["/repo/kept"]);
    expect(store.getState().workspaces[0]?.path).toBe("/repo/kept");
    expect(recentCalls).toBeGreaterThanOrEqual(2);
    expect(listAllCalls).toBeGreaterThanOrEqual(2);
    store.disconnect();
  });

  test("Scenario: Given workspace-scoped settings When loading and saving layers Then store uses workspacePath instead of session state", async () => {
    const listCalls: Array<{ workspacePath: string }> = [];
    const readCalls: Array<{ workspacePath: string; layerId: string }> = [];
    const saveCalls: Array<{ workspacePath: string; layerId: string; content: string; baseMtimeMs: number }> = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(700),
      listSettingsLayersQuery: async (input) => {
        listCalls.push(input);
        return {
          effective: { content: '{"lang":"en"}' },
          layers: [
            {
              layerId: "1:project",
              sourceId: "project",
              path: `${input.workspacePath}/.agenter/settings.json`,
              exists: true,
              editable: true,
            },
          ],
        };
      },
      readSettingsLayerQuery: async (input) => {
        readCalls.push(input);
        return {
          layer: {
            layerId: input.layerId,
            sourceId: "project",
            path: `${input.workspacePath}/.agenter/settings.json`,
            exists: true,
            editable: true,
          },
          path: `${input.workspacePath}/.agenter/settings.json`,
          content: '{"lang":"en"}',
          mtimeMs: 7,
        };
      },
      saveSettingsLayerMutate: async (input) => {
        saveCalls.push(input);
        return {
          ok: true,
          file: {
            path: `${input.workspacePath}/.agenter/settings.json`,
            content: input.content,
            mtimeMs: input.baseMtimeMs + 1,
          },
          effective: {
            content: input.content,
          },
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const layers = await store.listSettingsLayers("/repo/demo");
    const file = await store.readSettingsLayer("/repo/demo", "1:project");
    const saved = await store.saveSettingsLayer({
      workspacePath: "/repo/demo",
      layerId: "1:project",
      content: '{"lang":"ja"}',
      baseMtimeMs: 7,
    });

    expect(layers.layers[0]?.layerId).toBe("1:project");
    expect(file.path).toBe("/repo/demo/.agenter/settings.json");
    expect(saved.ok).toBe(true);
    expect(listCalls).toEqual([{ workspacePath: "/repo/demo" }]);
    expect(readCalls).toEqual([{ workspacePath: "/repo/demo", layerId: "1:project" }]);
    expect(saveCalls).toEqual([
      {
        workspacePath: "/repo/demo",
        layerId: "1:project",
        content: '{"lang":"ja"}',
        baseMtimeMs: 7,
      },
    ]);
    store.disconnect();
  });

  test("Scenario: Given unread notifications When visibility and consume updates arrive Then store keeps unread state in sync", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const visibilityInputs: Array<{ sessionId: string; chatId?: string; visible: boolean; focused: boolean }> = [];
    const consumeInputs: Array<{ sessionId: string; chatId?: string; terminalId?: string; upToMessageId?: string }> = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(800),
      notificationSnapshotQuery: async () => ({
        items: [
          {
            id: "i-1:9",
            sessionId: "i-1",
            sourceType: "chat",
            sourceId: "chat-main",
            chatId: "chat-main",
            workspacePath: "/repo/demo",
            sessionName: "workspace",
            messageId: "9",
            messageSeq: 9,
            content: "hello",
            timestamp: Date.now(),
          },
        ],
        unreadBySession: { "i-1": 1 },
        unreadByChat: { "i-1": { "chat-main": 1 } },
        unreadByTerminal: {},
      }),
      setChatVisibilityMutate: async (input) => {
        visibilityInputs.push(input);
        return {
          items: [
            {
              id: "i-1:9",
              sessionId: "i-1",
              sourceType: "chat",
              sourceId: "chat-main",
              chatId: "chat-main",
              workspacePath: "/repo/demo",
              sessionName: "workspace",
              messageId: "9",
              messageSeq: 9,
              content: "hello",
              timestamp: Date.now(),
            },
          ],
          unreadBySession: { "i-1": 1 },
          unreadByChat: { "i-1": { "chat-main": 1 } },
          unreadByTerminal: {},
        };
      },
      consumeNotificationsMutate: async (input) => {
        consumeInputs.push(input);
        return emptyNotificationSnapshot();
      },
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await waitFor(() => store.getState().unreadBySession["i-1"] === 1);
    expect(store.getState().unreadBySession["i-1"]).toBe(1);
    expect(store.getState().notifications[0]?.messageId).toBe("9");

    await store.setChatVisibility({ sessionId: "i-1", chatId: "chat-main", visible: true, focused: true });
    expect(visibilityInputs).toEqual([{ sessionId: "i-1", chatId: "chat-main", visible: true, focused: true }]);
    expect(store.getState().unreadBySession["i-1"]).toBe(1);

    onData?.({
      version: 1,
      eventId: 801,
      timestamp: Date.now(),
      type: "notification.updated",
      sessionId: "i-1",
      payload: {
        snapshot: {
          items: [
            {
              id: "i-1:10",
              sessionId: "i-1",
              sourceType: "chat",
              sourceId: "chat-main",
              chatId: "chat-main",
              workspacePath: "/repo/demo",
              sessionName: "workspace",
              messageId: "10",
              messageSeq: 10,
              content: "new reply",
              timestamp: Date.now(),
            },
          ],
          unreadBySession: { "i-1": 1 },
          unreadByChat: { "i-1": { "chat-main": 1 } },
          unreadByTerminal: {},
        },
      },
    });
    expect(store.getState().notifications[0]?.messageId).toBe("10");

    await store.consumeNotifications({ sessionId: "i-1", chatId: "chat-main", upToMessageId: "10" });
    expect(consumeInputs).toEqual([{ sessionId: "i-1", chatId: "chat-main", upToMessageId: "10" }]);
    expect(store.getState().notifications).toEqual([]);
    expect(store.getState().unreadBySession["i-1"]).toBeUndefined();
    store.disconnect();
  });

  test("Scenario: Given long-history hydration and a later live reply When hydrating session history Then persisted rows merge with live rows without dropping unread continuity", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(900),
      chatListQuery: async () => ({
        items: [
          {
            id: 10,
            sessionId: "i-1",
            messageId: "assistant-1",
            role: "assistant",
            channel: "to_user",
            content: "persisted reply",
            timestamp: 10,
            cycleId: 1,
            format: "markdown",
            tool: null,
            attachments: [],
          },
          {
            id: 11,
            sessionId: "i-1",
            messageId: "user-2",
            role: "user",
            channel: "user_input",
            content: "persisted follow-up",
            timestamp: 20,
            cycleId: 2,
            format: "markdown",
            tool: null,
            attachments: [],
          },
        ],
      }),
      chatCyclesQuery: async () => ({
        items: [],
      }),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    onData?.({
      version: 1,
      eventId: 901,
      timestamp: Date.now(),
      type: "chat.message",
      sessionId: "i-1",
      payload: {
        message: {
          id: "assistant-live",
          role: "assistant",
          channel: "to_user",
          content: "live reply",
          timestamp: 30,
          cycleId: 3,
        },
      },
    });

    await store.hydrateSessionHistory("i-1", { messageLimit: 200, cycleLimit: 120 });

    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.id)).toEqual([
      "assistant-1",
      "user-2",
      "assistant-live",
    ]);
    store.disconnect();
  });

  test("Scenario: Given runtime snapshot already contains in-memory chat rows When persisted history hydrates Then semantic duplicates collapse to the persisted records", async () => {
    const snapshot = createSnapshot(905);
    snapshot.runtimes["i-1"]!.chatMessages = [
      {
        id: "live-user-1",
        chatId: "chat-main",
        role: "user",
        content: "persisted user",
        timestamp: 10,
        cycleId: 1,
        attachments: [],
      },
      {
        id: "live-assistant-1",
        chatId: "chat-main",
        role: "assistant",
        channel: "to_user",
        content: "persisted assistant",
        timestamp: 20,
        cycleId: 1,
        attachments: [],
      },
    ];

    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => snapshot,
        chatListQuery: async () => ({
          items: [
            {
              id: 100,
              sessionId: "i-1",
              messageId: "100",
              chatId: "chat-main",
              role: "user",
              channel: "user_input",
              content: "persisted user",
              timestamp: 10,
              cycleId: 1,
              format: "markdown",
              tool: null,
              attachments: [],
            },
            {
              id: 101,
              sessionId: "i-1",
              messageId: "101",
              chatId: "chat-main",
              role: "assistant",
              channel: "to_user",
              content: "persisted assistant",
              timestamp: 20,
              cycleId: 1,
              format: "markdown",
              tool: null,
              attachments: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
        }),
        chatCyclesQuery: async () => ({
          items: [],
          nextBefore: null,
          hasMoreBefore: false,
        }),
      }),
    );

    await store.connect();
    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.id)).toEqual(["live-user-1", "live-assistant-1"]);

    await store.hydrateSessionHistory("i-1", { messageLimit: 200, cycleLimit: 120 });

    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.id)).toEqual(["100", "101"]);
    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.chatId)).toEqual(["chat-main", "chat-main"]);
    store.disconnect();
  });

  test("Scenario: Given snapshot has session without runtime When runtime events arrive Then scaffold is created and loopbus state updates", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const snapshot = createSnapshot(300);
    const client = createMockClient({
      snapshotQuery: async () => ({
        ...snapshot,
        runtimes: {},
      }),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);
    await store.connect();

    onData?.({
      version: 1,
      eventId: 301,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "collecting_inputs" },
    });
    onData?.({
      version: 1,
      eventId: 302,
      timestamp: Date.now(),
      type: "runtime.observability.trace",
      sessionId: "i-1",
      payload: {
        entry: createTraceEntry({
          id: 302,
          cycleId: 1,
          attributes: { inputs: 1 },
        }),
      },
    });

    const runtime = store.getState().runtimes["i-1"];
    expect(runtime).toBeDefined();
    expect(runtime?.schedulerPhase).toBe("collecting_inputs");
    expect(store.getState().observabilityTracesBySession["i-1"]?.length).toBe(1);
    store.disconnect();
  });

  test("Scenario: Given optimistic chat send When a cycle update arrives Then the pending cycle is replaced by the persisted cycle", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(600),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);
    await store.connect();

    await store.sendChat("i-1", "hello cycle");
    const pending = store.getState().chatCyclesBySession["i-1"] ?? [];
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe("pending");

    const clientMessageId = pending[0]?.clientMessageIds[0];
    if (!clientMessageId) {
      throw new Error("expected optimistic client message id");
    }

    onData?.({
      version: 1,
      eventId: 601,
      timestamp: Date.now(),
      type: "runtime.cycle.updated",
      sessionId: "i-1",
      payload: {
        cycle: {
          id: "cycle:9",
          cycleId: 9,
          seq: 9,
          createdAt: Date.now(),
          wakeSource: "user",
          kind: "model",
          status: "done",
          clientMessageIds: [clientMessageId],
          inputs: [
            {
              source: "message",
              role: "user",
              name: "User",
              parts: [{ type: "text", text: "hello cycle" }],
              meta: { clientMessageId },
            },
          ],
          outputs: [
            {
              id: "reply-1",
              role: "assistant",
              content: "done",
              timestamp: Date.now(),
              channel: "to_user",
            },
          ],
          liveMessages: [],
          streaming: null,
          modelCallId: 12,
        },
      },
    });

    const cycles = store.getState().chatCyclesBySession["i-1"] ?? [];
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.id).toBe("cycle:9");
    expect(cycles[0]?.outputs[0]?.content).toBe("done");
    store.disconnect();
  });

  test("Scenario: Given uploaded session assets When sending chat Then resolved asset urls and optimistic attachment parts stay aligned", async () => {
    const originalFetch = globalThis.fetch;
    const sentPayloads: Array<{ sessionId: string; text: string; assetIds: string[]; clientMessageId: string }> = [];
    globalThis.fetch = (async (input) => {
      expect(input).toBe("http://127.0.0.1:3000/api/sessions/i-1/assets");
      return new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              assetId: "asset-1",
              kind: "file",
              mimeType: "text/plain",
              name: "notes.txt",
              sizeBytes: 5,
              url: "/media/sessions/i-1/assets/asset-1",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(700),
      chatSendMutate: async (payload) => {
        sentPayloads.push(payload);
        return { ok: true };
      },
    });
    const store = new RuntimeStore(client);

    try {
      await store.connect();
      const uploaded = await store.uploadSessionAssets("i-1", [
        new File(["hello"], "notes.txt", { type: "text/plain" }),
      ]);

      expect(uploaded).toEqual([
        {
          assetId: "asset-1",
          kind: "file",
          mimeType: "text/plain",
          name: "notes.txt",
          sizeBytes: 5,
          url: "http://127.0.0.1:3000/media/sessions/i-1/assets/asset-1",
        },
      ]);

      await store.sendChat(
        "i-1",
        "review attachment",
        uploaded.map((item) => item.assetId),
        uploaded,
      );

      expect(sentPayloads).toHaveLength(1);
      expect(sentPayloads[0]?.sessionId).toBe("i-1");
      expect(sentPayloads[0]?.text).toBe("review attachment");
      expect(sentPayloads[0]?.assetIds).toEqual(["asset-1"]);

      const pendingCycles = store.getState().chatCyclesBySession["i-1"] ?? [];
      expect(pendingCycles).toHaveLength(1);
      expect(pendingCycles[0]?.inputs[0]?.parts).toEqual([
        { type: "text", text: "review attachment" },
        {
          type: "file",
          assetId: "asset-1",
          kind: "file",
          mimeType: "text/plain",
          name: "notes.txt",
          sizeBytes: 5,
          url: "http://127.0.0.1:3000/media/sessions/i-1/assets/asset-1",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      store.disconnect();
    }
  });

  test("Scenario: Given profile-service endpoint discovery When building icon and WebAuthn URLs Then runtime store targets the independent service", async () => {
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(701),
      profileServiceQuery: async () => ({ endpoint: "http://127.0.0.1:4591" }),
    });
    const store = new RuntimeStore(client);

    await store.connect();

    expect(store.sessionIconUrl("i-1")).toBe("http://127.0.0.1:4591/media/sessions/i-1/icon");
    expect(store.profileIconUrl("gaubee")).toBe("http://127.0.0.1:4591/media/profiles/gaubee/icon");
    expect(store.webauthnRegistrationUrl("ticket-1")).toBe("http://127.0.0.1:4591/auth/webauthn/register?ticket=ticket-1");
    expect(store.webauthnAuthenticationUrl("profile-1")).toBe(
      "http://127.0.0.1:4591/auth/webauthn/authenticate?reference=profile-1",
    );

    store.disconnect();
  });

  test("Scenario: Given hydrateRuntime no longer sees a runtime When stopSession completes Then paused runtime scaffolding is kept while persisted cycles remain visible", async () => {
    let snapshotCalls = 0;
    const pausedSession = {
      ...createSnapshot(0).sessions[0],
      status: "paused" as const,
    };
    const persistedAttention = {
      snapshot: {
        contexts: [
          {
            contextId: "ctx-chat-kzf",
            owner: "avatar:jane",
            content: "ask gaubee lunch",
            contentFormat: "markdown",
            scoreMap: { a1b2c3: 100 },
            headCommitId: "commit-1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            commitCount: 1,
            commitsTruncated: false,
            commits: [
              {
                commitId: "commit-1",
                contextId: "ctx-chat-kzf",
                parentCommitIds: [],
                meta: { author: "user:kzf", source: "message", createdAt: new Date().toISOString() },
                scores: { a1b2c3: 100 },
                summary: "Need lunch reply",
                change: { type: "update", value: "ask gaubee lunch", format: "markdown" },
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
      },
      active: [],
      cycleFrames: [],
      hooks: [],
    };
    const client = createMockClient({
      snapshotQuery: async () => {
        snapshotCalls += 1;
        if (snapshotCalls === 1) {
          return createSnapshot(800);
        }
        return {
          ...createSnapshot(801),
          sessions: [pausedSession],
          runtimes: {},
        };
      },
      attentionStateQuery: async () => persistedAttention,
    });
    client.trpc.session.stop.mutate = async () => ({ session: pausedSession });

    const store = new RuntimeStore(client);
    const internal = store as unknown as { applyEvent: (event: unknown) => void };
    await store.connect();
    expect(store.getState().runtimes["i-1"]?.started).toBe(true);
    internal.applyEvent({
      version: 1,
      eventId: 801,
      type: "runtime.cycle.updated",
      sessionId: "i-1",
      timestamp: Date.now(),
      payload: {
        cycle: {
          id: "cycle:11",
          cycleId: 11,
          seq: 11,
          createdAt: Date.now(),
          wakeSource: "user",
          kind: "model",
          status: "done",
          clientMessageIds: ["client-11"],
          inputs: [
            {
              source: "message",
              role: "user",
              name: "User",
              parts: [{ type: "text", text: "hello cycle" }],
              meta: { clientMessageId: "client-11" },
            },
          ],
          outputs: [],
          liveMessages: [],
          streaming: null,
          modelCallId: 12,
        },
      },
    });

    await store.stopSession("i-1");

    expect(store.getState().runtimes["i-1"]?.started).toBe(true);
    expect(store.getState().runtimes["i-1"]?.terminals).toEqual([]);
    expect(store.getState().terminalSnapshotsBySession["i-1"]).toEqual({});
    expect(store.getState().chatCyclesBySession["i-1"]?.map((cycle) => cycle.id)).toEqual(["cycle:11"]);
    const storedAttention = store.getState().attentionBySession?.["i-1"];
    const runtimeAttention = store.getState().runtimes["i-1"]?.attention;
    expect(storedAttention).toBeDefined();
    expect(runtimeAttention).toBeDefined();
    expect(storedAttention?.snapshot.contexts[0]?.contextId).toBe("ctx-chat-kzf");
    expect(runtimeAttention?.snapshot.contexts[0]?.contextId).toBe("ctx-chat-kzf");
    store.disconnect();
  });

  test("Scenario: Given scheduler containment facts in runtime state When selectors read the cached runtime Then blocked/backoff diagnostics stay available without re-querying", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const schedulerState = {
      schemaVersion: 2 as const,
      stateVersion: 4,
      running: true,
      paused: false,
      runtimeStatus: "backoff" as const,
      phase: "waiting_commits" as const,
      gate: "waiting_input" as const,
      queueSize: 0,
      cycle: 7,
      sentBatches: 2,
      updatedAt: 1700000000000,
      lastMessageAt: 1700000000000,
      lastResponseAt: 1700000000100,
      lastWakeAt: 1700000000200,
      lastWakeSource: "attention",
      lastWakeCause: "attention_backoff",
      activeContextCount: 1,
      activeItemCount: 1,
      unresolvedScoreCount: 1,
      waitingReason: "attention_backoff",
      nextAutoWakeAt: 1700000000800,
      backoffMs: 600,
      retryCount: 1,
      blockedReason: null,
      lastProgressAt: 1699999999000,
      lastError: null,
    } satisfies NonNullable<RuntimeSnapshot["runtimes"][string]["schedulerState"]>;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(950, { schedulerState }),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
      }),
    );

    await store.connect();

    expect(store.getSchedulerState("i-1")).toMatchObject({
      runtimeStatus: "backoff",
      retryCount: 1,
      nextAutoWakeAt: 1700000000800,
    });
    expect(store.getSchedulerContainment("i-1")).toEqual({
      runtimeStatus: "backoff",
      waitingReason: "attention_backoff",
      nextAutoWakeAt: 1700000000800,
      backoffMs: 600,
      retryCount: 1,
      blockedReason: null,
      lastProgressAt: 1699999999000,
      lastError: null,
    });

    onData?.({
      version: 1,
      eventId: 951,
      timestamp: Date.now(),
      type: "runtime.scheduler.snapshot",
      sessionId: "i-1",
      payload: {
        snapshot: {
          state: {
            ...schedulerState,
            runtimeStatus: "blocked",
            waitingReason: "blocked",
            nextAutoWakeAt: null,
            backoffMs: null,
            retryCount: 2,
            blockedReason: "provider.unavailable",
          },
        },
      },
    });

    expect(store.getSchedulerContainment("i-1")).toEqual({
      runtimeStatus: "blocked",
      waitingReason: "blocked",
      nextAutoWakeAt: null,
      backoffMs: null,
      retryCount: 2,
      blockedReason: "provider.unavailable",
      lastProgressAt: 1699999999000,
      lastError: null,
    });
    store.disconnect();
  });

  test("Scenario: Given abort clears runtime ownership When the stopped event is applied Then volatile runtime state resets while persisted cycles remain inspectable", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const stoppedSession = {
      ...createSnapshot(0).sessions[0],
      status: "stopped" as const,
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(900),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
      }),
    );

    await store.connect();
    const internal = store as unknown as { applyEvent: (event: unknown) => void };
    internal.applyEvent({
      version: 1,
      eventId: 901,
      type: "runtime.cycle.updated",
      sessionId: "i-1",
      timestamp: Date.now(),
      payload: {
        cycle: {
          id: "cycle:12",
          cycleId: 12,
          seq: 12,
          createdAt: Date.now(),
          wakeSource: "user",
          kind: "model",
          status: "done",
          clientMessageIds: ["client-12"],
          inputs: [],
          outputs: [],
          liveMessages: [],
          streaming: null,
          modelCallId: 13,
        },
      },
    });
    onData?.({
      eventId: 902,
      type: "session.updated",
      sessionId: "i-1",
      timestamp: Date.now(),
      payload: { session: stoppedSession },
    });

    expect(store.getState().runtimes["i-1"]?.started).toBe(false);
    expect(store.getState().runtimes["i-1"]?.activeCycle).toBeNull();
    expect(store.getState().terminalReadsBySession["i-1"]).toEqual({});
    expect(store.getState().chatCyclesBySession["i-1"]?.map((cycle) => cycle.id)).toEqual(["cycle:12"]);
    store.disconnect();
  });

  test("Scenario: Given reverse-time chat pages When loading older history Then the store uses explicit cursors and prepends without duplicates", async () => {
    const chatRequests: Array<{ before?: { beforeTimeMs: number; beforeId: number } }> = [];
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(950),
        chatListQuery: async (input) => {
          chatRequests.push({ before: input.before });
          if (!input.before) {
            return {
              items: [
                {
                  id: 11,
                  sessionId: "i-1",
                  messageId: "11",
                  role: "user",
                  channel: "user_input",
                  content: "newer user",
                  timestamp: 2_000,
                  cycleId: 11,
                  format: "markdown",
                  tool: null,
                  attachments: [],
                },
                {
                  id: 12,
                  sessionId: "i-1",
                  messageId: "12",
                  role: "assistant",
                  channel: "to_user",
                  content: "newer assistant",
                  timestamp: 3_000,
                  cycleId: 12,
                  format: "markdown",
                  tool: null,
                  attachments: [],
                },
              ],
              nextBefore: { beforeTimeMs: 2_000, beforeId: 11 },
              hasMoreBefore: true,
            };
          }
          return {
            items: [
              {
                id: 9,
                sessionId: "i-1",
                messageId: "9",
                role: "user",
                channel: "user_input",
                content: "older user",
                timestamp: 1_000,
                cycleId: 9,
                format: "markdown",
                tool: null,
                attachments: [],
              },
              {
                id: 10,
                sessionId: "i-1",
                messageId: "10",
                role: "assistant",
                channel: "to_user",
                content: "older assistant",
                timestamp: 2_000,
                cycleId: 10,
                format: "markdown",
                tool: null,
                attachments: [],
              },
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    await store.connect();
    await store.loadChatMessages("i-1", 2);
    const output = await store.loadMoreChatMessagesBefore("i-1", 2);

    expect(chatRequests).toEqual([{ before: undefined }, { before: { beforeTimeMs: 2_000, beforeId: 11 } }]);
    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.id)).toEqual(["9", "10", "11", "12"]);
    expect(output).toEqual({ items: 2, hasMore: false });
    store.disconnect();
  });

  test("Scenario: Given terminal activity reverse pages When loading older rows Then the store keeps one scoped timeline per terminal", async () => {
    const activityRequests: Array<{ before?: { beforeTimeMs: number; beforeId: number } }> = [];
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(980),
        terminalActivityPageQuery: async (input) => {
          activityRequests.push({ before: input.before });
          if (!input.before) {
            return {
              items: [
                {
                  id: 21,
                  terminalId: "main",
                  createdAt: 2_000,
                  kind: "terminal_read",
                  cycleId: 21,
                  title: "read-21",
                  content: "stdout",
                },
                {
                  id: 22,
                  terminalId: "main",
                  createdAt: 3_000,
                  kind: "message",
                  cycleId: 22,
                  title: "message-22",
                  content: "assistant mentions main",
                },
              ],
              nextBefore: { beforeTimeMs: 2_000, beforeId: 21 },
              hasMoreBefore: true,
            };
          }
          return {
            items: [
              {
                id: 19,
                terminalId: "main",
                createdAt: 1_000,
                kind: "terminal_write",
                cycleId: 19,
                title: "write-19",
                content: "echo hi",
              },
              {
                id: 20,
                terminalId: "main",
                createdAt: 2_000,
                kind: "terminal_read",
                cycleId: 20,
                title: "read-20",
                content: "older stdout",
              },
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    await store.connect();
    await store.loadTerminalActivity("i-1", "main", 2);
    const output = await store.loadMoreTerminalActivity("i-1", "main", 2);

    expect(activityRequests).toEqual([{ before: undefined }, { before: { beforeTimeMs: 2_000, beforeId: 21 } }]);
    expect(store.getState().terminalActivityBySession["i-1"]?.main?.map((item) => item.id)).toEqual([19, 20, 21, 22]);
    expect(output).toEqual({ items: 2, hasMore: false });
    store.disconnect();
  });

  test("Scenario: Given runtime snapshot already contains focused chat-channel descriptors When the store hydrates a started session Then chat bootstrap does not need a second list call", async () => {
    let listChannelsCalls = 0;
    const channel = {
      chatId: "room-main",
      kind: "room" as const,
      title: "Main room",
      owner: "jane",
      participants: [
        { id: "avatar:jane", label: "jane", role: "avatar" as const },
        { id: "user:kzf", label: "kzf", role: "user" as const },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://127.0.0.1:7777/room/room-main?token=msgtok_admin",
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0, { messageChannels: [channel] }),
        messageListChannelsQuery: async () => {
          listChannelsCalls += 1;
          return { items: [channel] };
        },
      }),
    );

    await store.connect();

    expect(store.getState().messageChannelsBySession["i-1"]).toEqual({
      data: [channel],
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: expect.any(Number),
    });

    await expect(store.ensureMessageChannels("i-1")).resolves.toEqual([channel]);
    expect(listChannelsCalls).toBe(0);

    store.disconnect();
  });

  test("Scenario: Given tokenized chat-channel admin APIs When runtime store proxies message-system calls Then access tokens stay threaded without hidden session trust", async () => {
    const requests: {
      focus?: { sessionId: string; op: string; channels: Array<{ chatId: string; accessToken: string }> };
      send?: {
        sessionId: string;
        chatId: string;
        accessToken: string;
        text: string;
        assetIds?: string[];
        clientMessageId: string;
      };
      update?: {
        sessionId: string;
        chatId: string;
        accessToken: string;
        patch: {
          title?: string;
          participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
        };
      };
      listGrants?: { sessionId: string; chatId: string; accessToken: string };
      issue?: {
        sessionId: string;
        chatId: string;
        accessToken: string;
        role: "admin" | "member" | "readonly";
        label?: string;
        participantId?: string;
      };
      revoke?: { sessionId: string; chatId: string; accessToken: string; grantId: string };
    } = {};
    const channel = {
      chatId: "room-main",
      kind: "room" as const,
      title: "Main room",
      owner: "jane",
      participants: [
        { id: "avatar:jane", label: "jane", role: "avatar" as const },
        { id: "user:kzf", label: "kzf", role: "user" as const },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://127.0.0.1:7777/room/room-main?token=msgtok_admin",
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        messageListChannelsQuery: async () => ({ items: [channel] }),
        messageFocusMutate: async (input) => {
          requests.focus = input;
          return { items: [channel] };
        },
        messageSendMutate: async (input) => {
          requests.send = input;
          return { ok: true };
        },
        messageUpdateChannelMutate: async (input) => {
          requests.update = input;
          return {
            channel: {
              ...channel,
              title: input.patch.title ?? channel.title,
            },
          };
        },
        messageListChannelGrantsQuery: async (input) => {
          requests.listGrants = input;
          return {
            items: [
              {
                grantId: "grant-readonly",
                chatId: "chat-main",
                role: "readonly" as const,
                label: "Viewer",
                participantId: "user:gaubee",
                createdAt: 2,
              },
            ],
          };
        },
        messageIssueChannelGrantMutate: async (input) => {
          requests.issue = input;
          return {
            grant: {
              grantId: "grant-member",
              chatId: "chat-main",
              role: input.role,
              label: input.label,
              participantId: input.participantId,
              createdAt: 3,
              accessRole: input.role,
              accessToken: "msgtok_member",
              transportUrl: "ws://127.0.0.1:7777/room/chat-main?token=msgtok_member",
            },
          };
        },
        messageRevokeChannelGrantMutate: async (input) => {
          requests.revoke = input;
          return { ok: true };
        },
      }),
    );

    expect(await store.listMessageChannels("i-1")).toEqual([channel]);
    await store.focusMessageChannels({
      sessionId: "i-1",
      op: "replace",
      channels: [{ chatId: "chat-main", accessToken: "msgtok_admin" }],
    });
    await store.sendMessageChannel({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      text: "hello",
      assetIds: ["asset-1"],
    });
    const updated = await store.updateMessageChannel({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      patch: { title: "Updated chat" },
    });
    const grants = await store.listMessageChannelGrants({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
    });
    const issued = await store.issueMessageChannelGrant({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      role: "member",
      label: "Relay",
      participantId: "user:gaubee",
    });
    const revoked = await store.revokeMessageChannelGrant({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      grantId: "grant-member",
    });

    expect(requests.focus).toEqual({
      sessionId: "i-1",
      op: "replace",
      channels: [{ chatId: "chat-main", accessToken: "msgtok_admin" }],
    });
    expect(requests.send?.accessToken).toBe("msgtok_admin");
    expect(requests.send?.assetIds).toEqual(["asset-1"]);
    expect(requests.update?.patch.title).toBe("Updated chat");
    expect(requests.listGrants?.accessToken).toBe("msgtok_admin");
    expect(requests.issue?.participantId).toBe("user:gaubee");
    expect(requests.revoke).toEqual({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      grantId: "grant-member",
    });
    expect(updated.title).toBe("Updated chat");
    expect(grants[0]?.role).toBe("readonly");
    expect(issued.accessToken).toBe("msgtok_member");
    expect(revoked).toEqual({ ok: true });
  });

  test("Scenario: Given global room authority APIs When runtime store proxies room-first calls Then room refs stay independent from session routes", async () => {
    const requests: {
      list?: { includeArchived?: boolean };
      create?: {
        chatId?: string;
        kind: "room";
        title?: string;
        participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
        metadata?: Record<string, unknown>;
        adminToken?: string;
        focus?: boolean;
      };
      focus?: { op: string; channels: Array<{ chatId: string; accessToken?: string }> };
      snapshot?: { chatId: string; accessToken?: string; limit?: number };
      page?: {
        chatId: string;
        accessToken?: string;
        before?: { beforeTimeMs: number; beforeId: number };
        limit?: number;
      };
      send?: {
        chatId: string;
        accessToken?: string;
        text: string;
        assetIds?: string[];
        clientMessageId?: string;
      };
      update?: {
        chatId: string;
        accessToken?: string;
        patch: {
          title?: string;
          participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
          metadata?: Record<string, unknown>;
          adminGroupCandidateIds?: string[];
        };
      };
      listGrants?: { chatId: string; accessToken?: string };
      issue?: {
        chatId: string;
        accessToken?: string;
        role: "admin" | "member" | "readonly";
        participantId: string;
        label?: string;
        accessTokenHint?: string;
      };
      revoke?: { chatId: string; accessToken?: string; grantId: string };
      archive?: { chatId: string; accessToken?: string; archivedBy?: string };
    } = {};
    const room = {
      chatId: "room-ops",
      kind: "room" as const,
      title: "Ops room",
      owner: "ops-bot",
      participants: [
        { id: "avatar:ops-bot", label: "ops-bot", role: "avatar" as const },
        { id: "user:kzf", label: "kzf", role: "user" as const },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_ops_admin",
      transportUrl: "ws://127.0.0.1:7777/room/room-ops?token=msgtok_ops_admin",
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        messageGlobalListQuery: async (input) => {
          requests.list = input;
          return { items: [room] };
        },
        messageGlobalCreateMutate: async (input) => {
          requests.create = input;
          return { channel: room };
        },
        messageGlobalFocusMutate: async (input) => {
          requests.focus = input;
          return { ok: true, message: "focused", focusedChatIds: input.channels.map((channel) => channel.chatId) };
        },
        messageGlobalSnapshotQuery: async (input) => {
          requests.snapshot = input;
          return {
            channel: room,
            items: [
              {
                rowId: 11,
                messageId: "11",
                chatId: room.chatId,
                from: "ops-bot",
                kind: "text" as const,
                content: "snapshot",
                createdAt: 2,
                updatedAt: 2,
                attentionState: "loaded" as const,
                editable: false,
              },
            ],
            nextBefore: { beforeTimeMs: 2, beforeId: 11 },
            hasMoreBefore: true,
            headVersion: "7",
          };
        },
        messageGlobalPageQuery: async (input) => {
          requests.page = input;
          return {
            items: [
              {
                rowId: 10,
                messageId: "10",
                chatId: room.chatId,
                from: "ops-bot",
                kind: "text" as const,
                content: "older",
                createdAt: 1,
                updatedAt: 1,
                attentionState: "loaded" as const,
                editable: false,
              },
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
        messageGlobalSendMutate: async (input) => {
          requests.send = input;
          return { ok: true };
        },
        messageGlobalUpdateMutate: async (input) => {
          requests.update = input;
          return {
            channel: {
              ...room,
              title: input.patch.title ?? room.title,
            },
          };
        },
        messageGlobalListGrantsQuery: async (input) => {
          requests.listGrants = input;
          return {
            items: [
              {
                grantId: "grant-ops",
                chatId: room.chatId,
                role: "member" as const,
                label: "Observer",
                participantId: "auth:observer",
                createdAt: 3,
              },
            ],
          };
        },
        messageGlobalIssueGrantMutate: async (input) => {
          requests.issue = input;
          return {
            grant: {
              grantId: "grant-member",
              chatId: input.chatId,
              role: input.role,
              label: input.label,
              participantId: input.participantId,
              createdAt: 4,
              accessRole: input.role,
              accessToken: "msgtok_member",
              transportUrl: "ws://127.0.0.1:7777/room/room-ops?token=msgtok_member",
            },
          };
        },
        messageGlobalRevokeGrantMutate: async (input) => {
          requests.revoke = input;
          return { ok: true };
        },
        messageGlobalDeleteMutate: async (input) => {
          requests.archive = input;
          return { channel: { ...room, archivedAt: 9, archivedBy: input.archivedBy ?? "ops-bot" } };
        },
      }),
    );

    expect(await store.listGlobalRooms()).toEqual([room]);
    expect(await store.createGlobalRoom({ title: "Ops room" })).toEqual(room);
    expect(
      await store.focusGlobalRooms({
        op: "replace",
        channels: [{ chatId: room.chatId, accessToken: room.accessToken }],
      }),
    ).toEqual({
      ok: true,
      message: "focused",
      focusedChatIds: [room.chatId],
    });
    expect(await store.snapshotGlobalRoom({ chatId: room.chatId, accessToken: room.accessToken, limit: 20 })).toEqual({
      channel: room,
      items: [
        {
          rowId: 11,
          messageId: "11",
          chatId: room.chatId,
          from: "ops-bot",
          kind: "text",
          content: "snapshot",
          createdAt: 2,
          updatedAt: 2,
          attentionState: "loaded",
          editable: false,
        },
      ],
      nextBefore: { beforeTimeMs: 2, beforeId: 11 },
      hasMoreBefore: true,
      headVersion: "7",
    });
    expect(
      await store.pageGlobalRoomMessages({
        chatId: room.chatId,
        accessToken: room.accessToken,
        before: { beforeTimeMs: 2, beforeId: 11 },
        limit: 20,
      }),
    ).toEqual({
      items: [
        {
          rowId: 10,
          messageId: "10",
          chatId: room.chatId,
          from: "ops-bot",
          kind: "text",
          content: "older",
          createdAt: 1,
          updatedAt: 1,
          attentionState: "loaded",
          editable: false,
        },
      ],
      hasMore: false,
      nextBefore: null,
    });
    expect(
      await store.sendGlobalRoomMessage({
        chatId: room.chatId,
        accessToken: room.accessToken,
        text: "hello ops",
        assetIds: ["asset-1"],
      }),
    ).toEqual({ ok: true });
    const updated = await store.updateGlobalRoom({
      chatId: room.chatId,
      accessToken: room.accessToken,
      patch: { title: "Ops renamed", adminGroupCandidateIds: ["auth:admin-a"] },
    });
    const grants = await store.listGlobalRoomGrants({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    const issued = await store.issueGlobalRoomGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      participantId: "auth:observer",
      label: "Observer",
    });
    const revoked = await store.revokeGlobalRoomGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      grantId: "grant-member",
    });
    const archived = await store.archiveGlobalRoom({
      chatId: room.chatId,
      accessToken: room.accessToken,
      archivedBy: "ops-bot",
    });

    expect(requests.list).toEqual({});
    expect(requests.create?.title).toBe("Ops room");
    expect(requests.focus).toEqual({
      op: "replace",
      channels: [{ chatId: room.chatId, accessToken: room.accessToken }],
    });
    expect(requests.snapshot).toEqual({ chatId: room.chatId, accessToken: room.accessToken, limit: 20 });
    expect(requests.page).toEqual({
      chatId: room.chatId,
      accessToken: room.accessToken,
      before: { beforeTimeMs: 2, beforeId: 11 },
      limit: 20,
    });
    expect(requests.send?.text).toBe("hello ops");
    expect(requests.send?.assetIds).toEqual(["asset-1"]);
    expect(requests.update?.patch.adminGroupCandidateIds).toEqual(["auth:admin-a"]);
    expect(requests.listGrants?.accessToken).toBe(room.accessToken);
    expect(requests.issue?.participantId).toBe("auth:observer");
    expect(requests.revoke).toEqual({
      chatId: room.chatId,
      accessToken: room.accessToken,
      grantId: "grant-member",
    });
    expect(requests.archive).toEqual({
      chatId: room.chatId,
      accessToken: room.accessToken,
      archivedBy: "ops-bot",
    });
    expect(updated.title).toBe("Ops renamed");
    expect(grants[0]?.participantId).toBe("auth:observer");
    expect(issued.accessToken).toBe("msgtok_member");
    expect(revoked).toEqual({ ok: true });
    expect(archived.archivedBy).toBe("ops-bot");
  });
});
