import { describe, expect, test } from "bun:test";

import {
  ProductExtensionRuntimeClient,
  type ProductEnsureRoomBindingInput,
  type ProductEnsureTerminalBindingInput,
  type ProductExtensionRuntimeStore,
} from "../src";
import type {
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  ProductDelegationRecord,
  SessionEntry,
  WorkspacePrivateTextAssetEnsureOutput,
} from "../src";

const createSessionEntry = (workspacePath: string, avatar: string, name = avatar): SessionEntry => {
  const nowIso = new Date().toISOString();
  return {
    id: `session:${workspacePath}:${avatar}`,
    name,
    cwd: workspacePath,
    workspacePath,
    avatar,
    avatarPrincipalId: `auth:${avatar}`,
    createdAt: nowIso,
    updatedAt: nowIso,
    status: "running",
    storageState: "active",
    sessionRoot: `/tmp/${avatar}`,
    storeTarget: "global",
  };
};

const createAvatarEntry = (nickname: string): GlobalAvatarCatalogEntry => ({
  avatarPrincipalId: `auth:${nickname}`,
  runtimeId: `runtime:${nickname}`,
  nickname,
  displayName: nickname,
  classify: null,
  iconUrl: null,
  defaultAvatar: nickname === "default",
  sourceScope: "global",
  globalAvailable: true,
  workspacePrivateSlotReady: false,
  globalPath: `/global/${nickname}`,
  workspacePrivatePath: `/workspace/.agenter/avatars/by-principal/${nickname}`,
  effectivePath: `/global/${nickname}`,
});

const createTerminalEntry = (
  terminalId: string,
  metadata: Record<string, unknown> = {},
  processPhase: GlobalTerminalEntry["processPhase"] = "running",
): GlobalTerminalEntry => ({
  terminalId,
  processKind: "shell",
  backend: "xterm",
  command: ["/bin/bash"],
  launchCwd: "/repo",
  workspace: null,
  status: "IDLE",
  processPhase,
  seq: 1,
  snapshot: {
    seq: 1,
    timestamp: 1,
    cols: 80,
    rows: 24,
    lines: Array.from({ length: 24 }, () => ""),
    cursor: { x: 0, y: 0 },
  },
  focused: false,
  icon: undefined,
  configuredTitle: terminalId,
  currentTitle: undefined,
  currentPath: undefined,
  shortcuts: undefined,
  rendererPreference: "auto",
  theme: "default-dark",
  cursor: "block",
  font: {
    family: "monospace",
    sizePx: 13,
    lineHeight: 1.4,
    letterSpacing: 0,
    weight: "400",
    weightBold: "700",
    ligatures: false,
  },
  transportUrl: `ws://127.0.0.1/pty/${terminalId}`,
  currentAdminId: null,
  approvalTimeoutMs: 90_000,
  pendingRequestCount: 0,
  access: {
    role: "admin",
    accessToken: `tok:${terminalId}`,
    participantId: "system:trusted-terminal-bootstrap",
    currentAdmin: true,
  },
  actors: [],
  metadata,
});

const createRoomEntry = (chatId: string, metadata: Record<string, unknown> = {}): GlobalRoomEntry => ({
  chatId,
  kind: "room",
  title: chatId,
  owner: "ops",
  participants: [{ id: "auth:user", label: "User" }],
  metadata,
  createdAt: 1,
  updatedAt: 1,
  focused: false,
  accessRole: "admin",
  accessToken: `tok:${chatId}`,
});

class FakeProductRuntimeStore implements ProductExtensionRuntimeStore {
  readonly avatars: GlobalAvatarCatalogEntry[] = [];
  readonly sessions = new Map<string, SessionEntry>();
  readonly terminals: GlobalTerminalEntry[] = [];
  readonly terminalGrants = new Map<string, GlobalTerminalGrantEntry[]>();
  readonly bootstrapTerminalCalls: string[] = [];
  readonly setTerminalConfigCalls: Array<{
    terminalId: string;
    processKind?: string;
    backend?: "xterm" | "ghostty-native";
    command?: string[];
    launchCwd?: string;
    metadata?: Record<string, unknown>;
  }> = [];
  readonly rooms: GlobalRoomEntry[] = [];
  readonly roomGrants = new Map<string, GlobalRoomGrantEntry[]>();
  readonly privateAssets = new Map<string, WorkspacePrivateTextAssetEnsureOutput>();
  readonly delegations: ProductDelegationRecord[] = [];
  readonly focusTerminalCalls: string[][] = [];
  readonly focusRoomCalls: string[][] = [];
  lastAttentionCommit: Record<string, unknown> | null = null;
  lastAttentionSettle: Record<string, unknown> | null = null;
  private readonly settings = new Map<string, { path: string; content: string; mtimeMs: number }>();

  forcePromptContent(sessionId: string, content: string): void {
    this.settings.set(sessionId, {
      path: `/tmp/${sessionId}/AGENTER.mdx`,
      content,
      mtimeMs: Date.now(),
    });
  }

  forcePrivateAssetContent(key: string, content: string): void {
    const current = this.privateAssets.get(key);
    if (!current) {
      throw new Error(`unknown asset: ${key}`);
    }
    this.privateAssets.set(key, {
      ...current,
      created: false,
      content,
      mtimeMs: Date.now(),
    });
  }

  async createSession(input: { cwd: string; name?: string; avatar?: string; autoStart?: boolean }): Promise<SessionEntry> {
    const avatar = input.avatar ?? "default";
    const key = `${input.cwd}:${avatar}`;
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }
    const created = createSessionEntry(input.cwd, avatar, input.name ?? avatar);
    this.sessions.set(key, created);
    this.settings.set(created.id, {
      path: `/tmp/${created.id}/AGENTER.mdx`,
      content: "",
      mtimeMs: 0,
    });
    return created;
  }

  async hydrateGlobalAvatarCatalog(): Promise<GlobalAvatarCatalogEntry[]> {
    return [...this.avatars];
  }

  async createGlobalAvatar(input: {
    nickname: string;
    displayName?: string | null;
    classify?: GlobalAvatarCatalogEntry["classify"];
  }): Promise<GlobalAvatarCatalogEntry> {
    const created = {
      ...createAvatarEntry(input.nickname),
      displayName: input.displayName ?? input.nickname,
      classify: input.classify ?? null,
    };
    this.avatars.push(created);
    return created;
  }

  async readSettings(
    sessionId: string,
    _kind: "settings" | "agenter" | "system" | "template" | "contract",
  ): Promise<{ path: string; content: string; mtimeMs: number }> {
    return this.settings.get(sessionId) ?? {
      path: `/tmp/${sessionId}/AGENTER.mdx`,
      content: "",
      mtimeMs: 0,
    };
  }

  async saveSettings(input: {
    sessionId: string;
    kind: "settings" | "agenter" | "system" | "template" | "contract";
    content: string;
    baseMtimeMs: number;
  }): Promise<
    | { ok: true; file: { path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number } }
  > {
    const current = await this.readSettings(input.sessionId, input.kind);
    if (current.mtimeMs !== input.baseMtimeMs) {
      return {
        ok: false,
        reason: "conflict",
        latest: current,
      };
    }
    const saved = {
      path: current.path,
      content: input.content,
      mtimeMs: Date.now(),
    };
    this.settings.set(input.sessionId, saved);
    return {
      ok: true,
      file: saved,
    };
  }

  async listGlobalTerminals(): Promise<GlobalTerminalEntry[]> {
    return [...this.terminals];
  }

  async createGlobalTerminal(input: {
    terminalId?: string;
    processKind?: string;
    backend?: "xterm" | "ghostty-native";
    command?: string[];
    cwd?: string;
    profile?: NonNullable<ProductEnsureTerminalBindingInput["createInput"]>["profile"];
    metadata?: Record<string, unknown>;
    start?: boolean;
    focus?: boolean;
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    const terminal = createTerminalEntry(input.terminalId ?? `terminal-${this.terminals.length + 1}`, input.metadata ?? {});
    this.terminals.push(terminal);
    return { ok: true, message: "terminal created", terminal };
  }

  async listGlobalTerminalGrants(terminalId: string): Promise<GlobalTerminalGrantEntry[]> {
    return [...(this.terminalGrants.get(terminalId) ?? [])];
  }

  async bootstrapGlobalTerminal(input: { terminalId: string }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    this.bootstrapTerminalCalls.push(input.terminalId);
    const index = this.terminals.findIndex((entry) => entry.terminalId === input.terminalId);
    if (index === -1) {
      return { ok: false, message: "terminal missing" };
    }
    const next = {
      ...this.terminals[index]!,
      processPhase: "running" as const,
      status: "IDLE" as const,
    };
    this.terminals[index] = next;
    return { ok: true, message: "bootstrapped", terminal: next };
  }

  async setGlobalTerminalConfig(input: {
    terminalId: string;
    processKind?: string;
    backend?: "xterm" | "ghostty-native";
    command?: string[];
    launchCwd?: string;
    env?: Record<string, string>;
    cols?: number;
    rows?: number;
    gitLog?: false | "none" | "normal" | "verbose";
    logStyle?: "plain" | "rich";
    title?: string;
    icon?: string;
    shortcuts?: Record<string, string>;
    rendererPreference?: "auto" | "ghostty-web" | "wterm" | "xterm";
    theme?: "default-dark" | "default-light" | "monokai";
    cursor?: "block" | "bar" | "underline";
    font?: {
      family: string;
      sizePx: number;
      lineHeight: number;
      letterSpacing: number;
      weight: string;
      weightBold: string;
      ligatures: boolean;
    };
    metadata?: Record<string, unknown>;
  }): Promise<unknown> {
    this.setTerminalConfigCalls.push({
      terminalId: input.terminalId,
      processKind: input.processKind,
      backend: input.backend,
      command: input.command,
      launchCwd: input.launchCwd,
      metadata: input.metadata,
    });
    const index = this.terminals.findIndex((entry) => entry.terminalId === input.terminalId);
    if (index === -1) {
      throw new Error(`unknown terminal: ${input.terminalId}`);
    }
    const current = this.terminals[index]!;
    const next: GlobalTerminalEntry = {
      ...current,
      processKind: input.processKind ?? current.processKind,
      backend: input.backend ?? current.backend,
      command: input.command ? [...input.command] : current.command,
      launchCwd: input.launchCwd ?? current.launchCwd,
      icon: input.icon ?? current.icon,
      configuredTitle: input.title ?? current.configuredTitle,
      shortcuts: input.shortcuts ?? current.shortcuts,
      metadata: {
        ...current.metadata,
        ...(input.metadata ?? {}),
      },
    };
    this.terminals[index] = next;
    return {
      config: {
        terminalId: next.terminalId,
      },
    };
  }

  async issueGlobalTerminalGrant(input: {
    terminalId: string;
    role: "admin" | "writer" | "requester" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }): Promise<unknown> {
    const grants = this.terminalGrants.get(input.terminalId) ?? [];
    grants.push({
      grantId: `grant:${input.terminalId}:${input.participantId}`,
      terminalId: input.terminalId,
      role: input.role,
      participantId: input.participantId,
      label: input.label,
      accessToken: `grant-token:${input.terminalId}:${input.participantId}`,
      createdAt: Date.now(),
    });
    this.terminalGrants.set(input.terminalId, grants);
    return { ok: true, accessToken: `grant-token:${input.terminalId}:${input.participantId}` };
  }

  async focusTerminals(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }> {
    void input.sessionId;
    void input.op;
    this.focusTerminalCalls.push([...input.terminalIds]);
    return { ok: true, message: "focused", focusedTerminalIds: input.terminalIds };
  }

  async focusGlobalTerminals(input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
    accessToken?: string;
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }> {
    this.focusTerminalCalls.push([...input.terminalIds]);
    return { ok: true, message: "focused", focusedTerminalIds: input.terminalIds };
  }

  async listGlobalRooms(): Promise<GlobalRoomEntry[]> {
    return [...this.rooms];
  }

  async createGlobalRoom(input: {
    chatId?: string;
    title?: string;
    participants?: Array<{ id: string; label?: string }>;
    initialUsers?: Array<{
      actorId: GlobalRoomActorId;
      label?: string;
      role: "admin" | "member" | "readonly";
      focused?: boolean;
    }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }): Promise<GlobalRoomEntry> {
    const room = createRoomEntry(input.chatId ?? `room-${this.rooms.length + 1}`, input.metadata ?? {});
    this.rooms.push(room);
    return room;
  }

  async listGlobalRoomGrants(input: { chatId: string; accessToken?: string }): Promise<GlobalRoomGrantEntry[]> {
    return [...(this.roomGrants.get(input.chatId) ?? [])];
  }

  async issueGlobalRoomGrant(input: {
    chatId: string;
    accessToken?: string;
    role: "admin" | "member" | "readonly";
    participantId: GlobalRoomActorId;
    label?: string;
    accessTokenHint?: string;
  }): Promise<unknown> {
    const grants = this.roomGrants.get(input.chatId) ?? [];
    grants.push({
      grantId: `grant:${input.chatId}:${input.participantId}`,
      chatId: input.chatId,
      role: input.role,
      participantId: input.participantId,
      label: input.label,
      accessToken: `grant-token:${input.chatId}:${input.participantId}`,
      createdAt: Date.now(),
    });
    this.roomGrants.set(input.chatId, grants);
    return { ok: true, accessToken: `grant-token:${input.chatId}:${input.participantId}` };
  }

  async focusMessageChannels(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken: string }>;
  }): Promise<GlobalRoomEntry[]> {
    void input.sessionId;
    void input.op;
    this.focusRoomCalls.push(input.channels.map((channel) => channel.chatId));
    return this.rooms.filter((entry) => input.channels.some((channel) => channel.chatId === entry.chatId));
  }

  async focusGlobalRooms(input: {
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken?: string }>;
  }): Promise<{ ok: boolean; message: string; focusedChatIds: string[] }> {
    this.focusRoomCalls.push(input.channels.map((channel) => channel.chatId));
    return {
      ok: true,
      message: "focused",
      focusedChatIds: input.channels.map((channel) => channel.chatId),
    };
  }

  async ensureWorkspacePrivateTextAsset(input: {
    workspacePath: string;
    avatarNickname: string;
    assetKind: "skills" | "memory" | "tools" | "archive";
    relativePath: string;
    seedContent: string;
  }): Promise<WorkspacePrivateTextAssetEnsureOutput> {
    const key = `${input.workspacePath}:${input.avatarNickname}:${input.assetKind}:${input.relativePath}`;
    const current = this.privateAssets.get(key);
    if (current) {
      return current;
    }
    const created = {
      path: input.relativePath,
      created: true,
      content: input.seedContent,
      mtimeMs: Date.now(),
    };
    this.privateAssets.set(key, created);
    return created;
  }

  async queryAttention(input: { sessionId: string; query: string; offset?: number; limit?: number }): Promise<[]> {
    return [];
  }

  async commitAttention(input: { sessionId: string } & Record<string, unknown>): Promise<{ commit: unknown }> {
    this.lastAttentionCommit = input;
    return { commit: { contextId: input.contextId } };
  }

  async settleAttention(input: { sessionId: string } & Record<string, unknown>): Promise<{ commit: unknown }> {
    this.lastAttentionSettle = input;
    return { commit: { contextId: input.contextId } };
  }

  async listProductDelegations(input: {
    productId: string;
    resourceKey?: string;
    runtimeId?: string;
    avatarActorId?: string;
    includeRevoked?: boolean;
  }): Promise<ProductDelegationRecord[]> {
    return this.delegations.filter((record) => record.productId === input.productId);
  }

  async createProductDelegation(input: {
    productId: string;
    resourceKey: string;
    runtimeId: string;
    avatarActorId: string;
    grantedByActorId: string;
    terminalId: string;
    roomId: string;
    enabledAt: number;
    expiresAt: number;
    policy: {
      mode: "observe" | "write" | "confirm-before-write";
      maxWriteBytes?: number;
    };
    provenance: {
      source: string;
      attentionContextId?: string;
      attentionCommitId?: string;
      terminalLeaseId?: string;
      notes?: string;
    };
  }): Promise<ProductDelegationRecord> {
    const created: ProductDelegationRecord = {
      ...input,
      delegationId: `delegation:${input.productId}:${input.resourceKey}`,
      status: "active",
    };
    this.delegations.push(created);
    return created;
  }

  async revokeProductDelegation(input: {
    delegationId: string;
    revokedAt: number;
    revokedReason: string;
  }): Promise<ProductDelegationRecord> {
    const current = this.delegations.find((record) => record.delegationId === input.delegationId);
    if (!current) {
      throw new Error(`unknown delegation: ${input.delegationId}`);
    }
    const revoked = {
      ...current,
      status: "revoked" as const,
      revokedAt: input.revokedAt,
      revokedReason: input.revokedReason,
    };
    const index = this.delegations.findIndex((record) => record.delegationId === input.delegationId);
    this.delegations.splice(index, 1, revoked);
    return revoked;
  }
}

describe("Feature: product extension runtime client", () => {
  test("Scenario: Given repeated runtime ensures for the same avatar When the shell name changes Then runtime identity stays avatar-scoped instead of product-session-scoped", async () => {
    const store = new FakeProductRuntimeStore();
    const client = new ProductExtensionRuntimeClient(store);

    const first = await client.ensureRuntime({
      workspacePath: "/repo",
      avatarNickname: "shell-assistant",
      sessionName: "shell-1",
    });
    const second = await client.ensureRuntime({
      workspacePath: "/repo",
      avatarNickname: "shell-assistant",
      sessionName: "shell-2",
    });

    expect(first.id).toBe(second.id);
    expect(second.avatar).toBe("shell-assistant");
    expect(second.name).toBe("shell-1");
    expect(store.sessions.size).toBe(1);
  });

  test("Scenario: Given a missing assistant prompt and memory pack When the client ensures them Then avatar creation and seed-if-missing stay generic and preserve later edits", async () => {
    const store = new FakeProductRuntimeStore();
    const client = new ProductExtensionRuntimeClient(store);

    const assistant = await client.ensureAssistant({
      productId: "cli-shell",
      workspacePath: "/repo",
      avatarNickname: "shell-assistant",
      displayName: "Shell Assistant",
    });
    const session = await client.ensureRuntime({
      workspacePath: "/repo",
      avatarNickname: "shell-assistant",
    });
    const firstPrompt = await client.ensurePromptSeedIfMissing({
      sessionId: session.id,
      kind: "agenter",
      seedContent: "# Seeded prompt\n",
    });
    const memory = await client.ensureMemoryPackIfMissing({
      workspacePath: "/repo",
      avatarNickname: "shell-assistant",
      roles: [
        {
          role: "pairing-playbook",
          path: "pairing-playbook.md",
          seedContent: "# Pairing playbook\n",
        },
      ],
    });

    store.forcePromptContent(session.id, "# User-edited prompt\n");
    store.forcePrivateAssetContent("/repo:shell-assistant:memory:pairing-playbook.md", "# User-edited playbook\n");

    const secondPrompt = await client.ensurePromptSeedIfMissing({
      sessionId: session.id,
      kind: "agenter",
      seedContent: "# Replacement prompt\n",
    });
    const secondMemory = await client.ensureMemoryPackIfMissing({
      workspacePath: "/repo",
      avatarNickname: "shell-assistant",
      roles: [
        {
          role: "pairing-playbook",
          path: "pairing-playbook.md",
          seedContent: "# Replacement playbook\n",
        },
      ],
    });

    expect(assistant.nickname).toBe("shell-assistant");
    expect(firstPrompt.seeded).toBe(true);
    expect(memory[0]?.created).toBe(true);
    expect(secondPrompt.seeded).toBe(false);
    expect(secondPrompt.file.content).toBe("# User-edited prompt\n");
    expect(secondMemory[0]?.content).toBe("# User-edited playbook\n");
  });

  test("Scenario: Given generic product bindings When ensuring missing terminal and room resources Then metadata keys drive creation grants and focus without cli-shell branches", async () => {
    const store = new FakeProductRuntimeStore();
    const client = new ProductExtensionRuntimeClient(store);

    const terminal = await client.ensureTerminalBinding({
      session: createSessionEntry("/repo", "shell-assistant"),
      binding: {
        productId: "cli-shell",
        resourceKey: "shell-1",
        resourceKind: "terminal",
        ownerSystem: "terminal-system",
      },
      participantId: "auth:shell-assistant",
      participantLabel: "Shell Assistant",
    });
    const room = await client.ensureRoomBinding({
      session: createSessionEntry("/repo", "shell-assistant"),
      binding: {
        productId: "cli-shell",
        resourceKey: "shell-1",
        resourceKind: "room",
        ownerSystem: "message-system",
        title: "shell-1",
      },
      participantId: "auth:shell-assistant",
      participantLabel: "Shell Assistant",
    });

    expect(terminal.created).toBe(true);
    expect(terminal.granted).toBe(true);
    expect(terminal.entry.backend).toBe("xterm");
    expect(terminal.bindingMetadata.resourceKey).toBe("shell-1");
    expect(terminal.entry.metadata?.productId).toBe("cli-shell");
    expect(room.created).toBe(true);
    expect(room.granted).toBe(true);
    expect(room.entry.metadata?.resourceKey).toBe("shell-1");
  });

  test("Scenario: Given existing bound resources When ensuring them again Then product metadata reuses the resources and skips duplicate grants", async () => {
    const store = new FakeProductRuntimeStore();
    const terminal = createTerminalEntry("shell-1", {
      productId: "cli-shell",
      resourceKey: "shell-1",
      ownerSystem: "terminal-system",
    });
    const room = createRoomEntry("room-shell-1", {
      productId: "cli-shell",
      resourceKey: "shell-1",
      ownerSystem: "message-system",
    });
    store.terminals.push(terminal);
    store.rooms.push(room);
    store.terminalGrants.set("shell-1", [
      {
        grantId: "grant:shell-1",
        terminalId: "shell-1",
        role: "writer",
        participantId: "auth:shell-assistant",
        label: "Shell Assistant",
        accessToken: "grant-token:shell-1",
        createdAt: 1,
      },
    ]);
    store.roomGrants.set("room-shell-1", [
      {
        grantId: "grant:room-shell-1",
        chatId: "room-shell-1",
        role: "member",
        participantId: "auth:shell-assistant",
        label: "Shell Assistant",
        createdAt: 1,
      },
    ]);
    const client = new ProductExtensionRuntimeClient(store);

    const ensuredTerminal = await client.ensureTerminalBinding({
      session: createSessionEntry("/repo", "shell-assistant"),
      binding: {
        productId: "cli-shell",
        resourceKey: "shell-1",
        resourceKind: "terminal",
        ownerSystem: "terminal-system",
      },
      participantId: "auth:shell-assistant",
    });
    const ensuredRoom = await client.ensureRoomBinding({
      session: createSessionEntry("/repo", "shell-assistant"),
      binding: {
        productId: "cli-shell",
        resourceKey: "shell-1",
        resourceKind: "room",
        ownerSystem: "message-system",
      },
      participantId: "auth:shell-assistant",
    });

    expect(ensuredTerminal.created).toBe(false);
    expect(ensuredTerminal.granted).toBe(false);
    expect(ensuredRoom.created).toBe(false);
    expect(ensuredRoom.granted).toBe(false);
    expect(store.focusTerminalCalls).toEqual([["shell-1"]]);
    expect(store.focusRoomCalls).toEqual([["room-shell-1"]]);
  });

  test("Scenario: Given an existing stopped terminal binding When the product requires start on reconnect Then the runtime client bootstraps the durable terminal before reuse", async () => {
    const store = new FakeProductRuntimeStore();
    store.terminals.push(
      createTerminalEntry(
        "shell-1",
        {
          productId: "cli-shell",
          resourceKey: "shell-1",
          ownerSystem: "terminal-system",
        },
        "stopped",
      ),
    );
    const client = new ProductExtensionRuntimeClient(store);

    const ensuredTerminal = await client.ensureTerminalBinding({
      session: createSessionEntry("/repo", "shell-assistant"),
      binding: {
        productId: "cli-shell",
        resourceKey: "shell-1",
        resourceKind: "terminal",
        ownerSystem: "terminal-system",
      },
      createInput: {
        processKind: "shell",
        cwd: "/repo",
        start: true,
      },
    });

    expect(ensuredTerminal.created).toBe(false);
    expect(ensuredTerminal.entry.processPhase).toBe("running");
    expect(store.bootstrapTerminalCalls).toEqual(["shell-1"]);
    expect(store.focusTerminalCalls).toEqual([["shell-1"]]);
  });

  test("Scenario: Given an existing legacy terminal without product metadata When ensuring the binding again Then the runtime client reconciles durable launch truth before reuse", async () => {
    const store = new FakeProductRuntimeStore();
    store.terminals.push(createTerminalEntry("shell-1", {}, "stopped"));
    const client = new ProductExtensionRuntimeClient(store);

    const ensuredTerminal = await client.ensureTerminalBinding({
      session: createSessionEntry("/repo", "shell-assistant"),
      binding: {
        productId: "cli-shell",
        resourceKey: "shell-1",
        resourceKind: "terminal",
        ownerSystem: "terminal-system",
      },
      createInput: {
        processKind: "shell",
        command: ["/bin/zsh", "-i"],
        cwd: "/repo/current",
        start: true,
      },
    });

    expect(ensuredTerminal.created).toBe(false);
    expect(store.setTerminalConfigCalls).toEqual([
      {
        terminalId: "shell-1",
        command: ["/bin/zsh", "-i"],
        launchCwd: "/repo/current",
        metadata: {
          productId: "cli-shell",
          resourceKey: "shell-1",
          ownerSystem: "terminal-system",
        },
      },
    ]);
    expect(ensuredTerminal.entry.command).toEqual(["/bin/zsh", "-i"]);
    expect(ensuredTerminal.entry.launchCwd).toBe("/repo/current");
    expect(ensuredTerminal.entry.metadata).toMatchObject({
      productId: "cli-shell",
      resourceKey: "shell-1",
      ownerSystem: "terminal-system",
    });
    expect(store.bootstrapTerminalCalls).toEqual(["shell-1"]);
  });

  test("Scenario: Given an existing stopped terminal with another backend When ensuring a new backend Then the runtime client patches durable backend truth before bootstrap", async () => {
    const store = new FakeProductRuntimeStore();
    store.terminals.push({
      ...createTerminalEntry("shell-1", {}, "stopped"),
      backend: "xterm",
    });
    const client = new ProductExtensionRuntimeClient(store);

    const ensuredTerminal = await client.ensureTerminalBinding({
      session: createSessionEntry("/repo", "shell-assistant"),
      binding: {
        productId: "cli-shell",
        resourceKey: "shell-1",
        resourceKind: "terminal",
        ownerSystem: "terminal-system",
      },
      createInput: {
        processKind: "shell",
        backend: "ghostty-native",
        start: true,
      },
    });

    expect(store.setTerminalConfigCalls).toEqual([
      {
        terminalId: "shell-1",
        processKind: undefined,
        backend: "ghostty-native",
        command: undefined,
        launchCwd: undefined,
        metadata: {
          productId: "cli-shell",
          resourceKey: "shell-1",
          ownerSystem: "terminal-system",
        },
      },
    ]);
    expect(store.bootstrapTerminalCalls).toEqual(["shell-1"]);
    expect(ensuredTerminal.entry.backend).toBe("ghostty-native");
  });

  test("Scenario: Given an existing running terminal with another backend When ensuring a requested backend Then the runtime client rejects the mismatch", async () => {
    const store = new FakeProductRuntimeStore();
    store.terminals.push({
      ...createTerminalEntry("shell-1", {}, "running"),
      backend: "xterm",
    });
    const client = new ProductExtensionRuntimeClient(store);

    await expect(
      client.ensureTerminalBinding({
        session: createSessionEntry("/repo", "shell-assistant"),
        binding: {
          productId: "cli-shell",
          resourceKey: "shell-1",
          resourceKind: "terminal",
          ownerSystem: "terminal-system",
        },
        createInput: {
          backend: "ghostty-native",
          start: true,
        },
      }),
    ).rejects.toThrow("terminal backend mismatch");
    expect(store.setTerminalConfigCalls).toEqual([]);
    expect(store.bootstrapTerminalCalls).toEqual([]);
  });

  test("Scenario: Given an existing running projection terminal with another backend When ensuring a requested backend Then the runtime client treats backend as projection config instead of PTY mismatch", async () => {
    const store = new FakeProductRuntimeStore();
    store.terminals.push({
      ...createTerminalEntry(
        "shell-1:terminal-2",
        {
          productId: "cli-shell",
          resourceKey: "shell-1:terminal-2",
          ownerSystem: "terminal-system",
          projectionSourceTerminalId: "shell-1:terminal-1",
        },
        "running",
      ),
      backend: "xterm",
    });
    const client = new ProductExtensionRuntimeClient(store);

    const ensuredTerminal = await client.ensureTerminalBinding({
      session: createSessionEntry("/repo", "shell-assistant"),
      binding: {
        productId: "cli-shell",
        resourceKey: "shell-1:terminal-2",
        resourceKind: "terminal",
        ownerSystem: "terminal-system",
        metadata: {
          projectionSourceTerminalId: "shell-1:terminal-1",
        },
      },
      createInput: {
        backend: "ghostty-native",
      },
    });

    expect(ensuredTerminal.created).toBe(false);
    expect(store.setTerminalConfigCalls).toEqual([
      {
        terminalId: "shell-1:terminal-2",
        processKind: undefined,
        backend: "ghostty-native",
        command: undefined,
        launchCwd: undefined,
        metadata: undefined,
      },
    ]);
    expect(ensuredTerminal.entry.backend).toBe("ghostty-native");
  });

  test("Scenario: Given self-evolution attention and explicit delegations When invoking the runtime client Then attention does not implicitly create hosting leases", async () => {
    const store = new FakeProductRuntimeStore();
    const client = new ProductExtensionRuntimeClient(store);

    await client.commitAttention({
      sessionId: "session:/repo:shell-assistant",
      contextId: "ctx-self-evolution",
      summary: "Learned a user preference from evidence.",
    });
    expect(store.lastAttentionCommit?.scores).toBeUndefined();
    expect(store.delegations).toHaveLength(0);

    const created = await client.createDelegation({
      productId: "cli-shell",
      resourceKey: "shell-1",
      runtimeId: "runtime-shell-assistant",
      avatarActorId: "auth:shell-assistant",
      grantedByActorId: "auth:user",
      terminalId: "shell-1",
      roomId: "room-shell-1",
      enabledAt: 10,
      expiresAt: 20,
      policy: { mode: "write" },
      provenance: { source: "product-extension-runtime" },
    });
    const revoked = await client.revokeDelegation({
      delegationId: created.delegationId,
      revokedAt: 30,
      revokedReason: "user_disabled",
    });

    expect(created.status).toBe("active");
    expect(revoked.status).toBe("revoked");
    expect(revoked.revokedReason).toBe("user_disabled");
  });
});
