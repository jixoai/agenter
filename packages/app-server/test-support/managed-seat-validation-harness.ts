import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel } from "../src";
import { startManagedSeatAuthorityServer } from "./managed-seat-authority-server";
import { buildManagedSeatSituationBrief, type ManagedSeatScenarioDefinition } from "./managed-seat-scenario-catalog";

interface SessionRuntimeLike {
  execRootWorkspaceBash: (input: {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  }) => Promise<{ stdout: string; stderr: string; exitCode: number; cwd: string }>;
  readRuntimeTerminal: (input: {
    terminalId: string;
    mode?: "auto" | "diff" | "snapshot";
    recordActivity?: boolean;
  }) => Promise<{
    snapshot?: {
      lines?: string[];
    };
  }>;
  writeRuntimeTerminal: (input: {
    terminalId: string;
    text: string;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
    readRecordActivity?: boolean;
    readMode?: "auto" | "diff" | "snapshot";
  }) => Promise<{
    ok: boolean;
    message: string;
    read?: {
      snapshot?: {
        lines?: string[];
      };
    };
  }>;
  readMessageChannel: (input: {
    chatId: string;
    limit?: number;
  }) => Promise<{
    items: Array<{
      content: string;
    }>;
  }>;
}

interface ManagedSeatInvitePayload {
  invitation?: {
    invitationId: string;
    descriptor: {
      token: string;
      deepLink?: string;
      httpUrl?: string;
    };
    status: "pending" | "accepted" | "revoked" | "expired";
    expiresAt?: number;
  };
}

interface ManagedSeatAcceptPayload {
  invitation?: {
    invitationId?: string;
    status?: "pending" | "accepted" | "revoked" | "expired";
    resourceId?: string;
  };
  access?: {
    accessToken?: string;
    role?: string;
    accessRole?: string;
  };
  seat?: {
    actorId?: string;
    role?: string;
    accessRole?: string;
  };
}

interface ManagedSeatConfigPayload {
  result?: {
    accessToken?: string;
    role?: string;
    accessRole?: string;
    seatClass?: string;
    invitationId?: string;
    status?: "pending" | "accepted" | "revoked" | "expired";
  };
}

interface ManagedSeatSessionContext {
  sessionId: string;
  principalId: `0x${string}`;
}

export interface ManagedSeatSameInstanceResult {
  scenarioId: string;
  descriptorProjection: "httpUrl" | "deepLink" | "token";
  invitationStatus: string;
  acceptedStatus: string;
  acceptedRole: string;
  roomDescriptorVisible: boolean;
  bobCanReadDescriptorTransport: boolean;
  bobReadText: string;
  aliceReadText: string;
  marker: string;
}

export interface ManagedSeatLifecycleMutationResult {
  scenarioId: string;
  reconfiguredRole: string;
  writeAfterConfigOk: boolean;
  readAfterConfigContainsMarker: boolean;
  expiredAcceptError: string;
  renewedExpiresAt: number;
  firstExpiresAt: number;
  staleAcceptError: string;
  revokedAcceptError: string;
}

export interface ManagedSeatManagementHandoffResult {
  scenarioId: string;
  acceptedRole: string;
  aliceCurrentAdmin: boolean;
  bobCurrentAdmin: boolean;
  bobAdminCandidateRank: number | null;
  currentAdminCount: number;
}

export interface ManagedSeatCrossInstanceResult {
  scenarioId: string;
  roomInviteAcceptedStatus: string;
  roomRelayVisibleOnAlice: boolean;
  terminalInviteAcceptedStatus: string;
  marker: string;
  aliceRemoteReadText: string;
  bobLocalReadText: string;
  roomAuthorityUrl: string;
  terminalAuthorityUrl: string;
}

const getRuntime = (kernel: AppKernel, sessionId: string): SessionRuntimeLike => {
  const runtimes = Reflect.get(kernel, "runtimes") as Map<string, unknown>;
  const runtime = runtimes.get(sessionId);
  if (!runtime) {
    throw new Error(`missing runtime for ${sessionId}`);
  }
  return runtime as SessionRuntimeLike;
};

const execRootWorkspaceBash = async (
  kernel: AppKernel,
  sessionId: string,
  input: {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  },
) => await getRuntime(kernel, sessionId).execRootWorkspaceBash(input);

const parseJson = <T>(text: string): T => JSON.parse(text) as T;

export const formatManagedSeatValidationFailure = (
  scenarioId: string,
  error: unknown,
  diagnostics: Record<string, unknown>,
): Error => {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`managed-seat validation failed (${scenarioId}): ${message}\n${JSON.stringify(diagnostics, null, 2)}`);
};

const extractDescriptor = (descriptor: {
  token: string;
  deepLink?: string;
  httpUrl?: string;
}): { value: string; projection: "httpUrl" | "deepLink" | "token" } => {
  if (descriptor.httpUrl) {
    return { value: descriptor.httpUrl, projection: "httpUrl" };
  }
  if (descriptor.deepLink) {
    return { value: descriptor.deepLink, projection: "deepLink" };
  }
  return { value: descriptor.token, projection: "token" };
};

const createKernel = async (name: string): Promise<{ root: string; workspace: string; kernel: AppKernel }> => {
  const root = mkdtempSync(join(tmpdir(), `agenter-managed-seat-${name}-`));
  const workspace = join(root, "workspace");
  mkdirSync(workspace, { recursive: true });
  const kernel = new AppKernel({
    homeDir: join(root, "home"),
    globalSessionRoot: join(root, "sessions"),
    archiveSessionRoot: join(root, "archive", "sessions"),
    workspacesPath: join(root, "workspaces.yaml"),
  });
  await kernel.start();
  return { root, workspace, kernel };
};

const createSessionContext = async (
  kernel: AppKernel,
  workspace: string,
  avatar: string,
): Promise<ManagedSeatSessionContext> => {
  const session = await kernel.createSession({
    cwd: workspace,
    avatar,
    autoStart: true,
  });
  const meta = kernel.getSession(session.id);
  if (!meta?.avatarPrincipalId) {
    throw new Error(`expected avatar principal for ${avatar}`);
  }
  return {
    sessionId: session.id,
    principalId: meta.avatarPrincipalId as `0x${string}`,
  };
};

const readTerminalText = async (kernel: AppKernel, sessionId: string, terminalId: string): Promise<string> => {
  const payload = await getRuntime(kernel, sessionId).readRuntimeTerminal({
    terminalId,
    mode: "snapshot",
    recordActivity: false,
  });
  return (payload.snapshot?.lines ?? []).join("\n");
};

const inviteTerminalSeat = async (input: {
  kernel: AppKernel;
  sessionId: string;
  terminalId: string;
  participantId: `0x${string}`;
  seatClass: "RO" | "RW" | "TM";
  authorityUrl: string;
  expiresAt?: number;
}): Promise<{ payload: ManagedSeatInvitePayload; descriptor: string; projection: "httpUrl" | "deepLink" | "token" }> => {
  const result = await execRootWorkspaceBash(input.kernel, input.sessionId, {
    command: "terminal-manage invite",
    stdin: JSON.stringify({
      terminalId: input.terminalId,
      participantId: input.participantId,
      seatClass: input.seatClass,
      authorityUrl: input.authorityUrl,
      ...(typeof input.expiresAt === "number" ? { expiresAt: input.expiresAt } : {}),
    }),
  });
  if (result.exitCode !== 0) {
    throw new Error(`terminal-manage invite failed: ${result.stderr || result.stdout}`);
  }
  const payload = parseJson<ManagedSeatInvitePayload>(result.stdout);
  if (!payload.invitation?.descriptor) {
    throw new Error("expected invitation descriptor");
  }
  const descriptor = extractDescriptor(payload.invitation.descriptor);
  return { payload, descriptor: descriptor.value, projection: descriptor.projection };
};

const acceptTerminalSeat = async (input: {
  kernel: AppKernel;
  sessionId: string;
  descriptor: string;
}): Promise<{ exitCode: number; stdout: string; stderr: string; payload?: ManagedSeatAcceptPayload }> => {
  const result = await execRootWorkspaceBash(input.kernel, input.sessionId, {
    command: "terminal-manage accept",
    stdin: JSON.stringify({
      descriptor: input.descriptor,
    }),
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    ...(result.exitCode === 0 ? { payload: parseJson<ManagedSeatAcceptPayload>(result.stdout) } : {}),
  };
};

const inviteRoomSeat = async (input: {
  kernel: AppKernel;
  sessionId: string;
  chatId: string;
  participantId: `0x${string}`;
  authorityUrl: string;
}): Promise<{ payload: ManagedSeatInvitePayload; descriptor: string; projection: "httpUrl" | "deepLink" | "token" }> => {
  const result = await execRootWorkspaceBash(input.kernel, input.sessionId, {
    command: "message-manage invite",
    stdin: JSON.stringify({
      chatId: input.chatId,
      participantId: input.participantId,
      seatClass: "member",
      authorityUrl: input.authorityUrl,
    }),
  });
  if (result.exitCode !== 0) {
    throw new Error(`message-manage invite failed: ${result.stderr || result.stdout}`);
  }
  const payload = parseJson<ManagedSeatInvitePayload>(result.stdout);
  if (!payload.invitation?.descriptor) {
    throw new Error("expected room invitation descriptor");
  }
  const descriptor = extractDescriptor(payload.invitation.descriptor);
  return { payload, descriptor: descriptor.value, projection: descriptor.projection };
};

const acceptRoomSeat = async (input: {
  kernel: AppKernel;
  sessionId: string;
  descriptor: string;
}): Promise<{ exitCode: number; stdout: string; stderr: string; payload?: ManagedSeatAcceptPayload }> => {
  const result = await execRootWorkspaceBash(input.kernel, input.sessionId, {
    command: "message-manage accept",
    stdin: JSON.stringify({
      descriptor: input.descriptor,
    }),
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    ...(result.exitCode === 0 ? { payload: parseJson<ManagedSeatAcceptPayload>(result.stdout) } : {}),
  };
};

export const runManagedSeatSameInstanceScenario = async (
  scenario: ManagedSeatScenarioDefinition,
): Promise<ManagedSeatSameInstanceResult> => {
  const { root, workspace, kernel } = await createKernel("same-instance");
  const authority = await startManagedSeatAuthorityServer(kernel);
  const diagnostics: Record<string, unknown> = {
    scenarioId: scenario.id,
    situationBrief: buildManagedSeatSituationBrief(scenario),
    topology: scenario.topology,
    roomAuthorityUrl: authority.authorityUrl,
  };
  try {
    const alice = await createSessionContext(kernel, workspace, "alice-same-instance");
    const bob = await createSessionContext(kernel, workspace, "bob-same-instance");

    const room = await kernel.createGlobalRoom({
      title: "managed-seat-same-instance",
      initialUsers: [
        { contactId: alice.principalId, label: "Alice", role: "member", focused: true },
        { contactId: bob.principalId, label: "Bob", role: "member", focused: true },
      ],
    });
    diagnostics.roomChatId = room.chatId;
    const created = await kernel.createGlobalTerminal({
      terminalId: "same-instance-terminal",
      processKind: "shell",
      command: ["sh", "-lc", "cat"],
      actorId: alice.principalId,
    });
    const terminalId = created.terminal?.terminalId;
    if (!created.ok || !terminalId) {
      throw new Error("expected terminal creation to succeed");
    }
    diagnostics.terminalId = terminalId;

    const invited = await inviteTerminalSeat({
      kernel,
      sessionId: alice.sessionId,
      terminalId,
      participantId: bob.principalId,
      seatClass: "RW",
      authorityUrl: authority.authorityUrl,
    });
    diagnostics.descriptorProjection = invited.projection;
    diagnostics.invitationStatus = invited.payload.invitation?.status ?? null;
    diagnostics.descriptor = invited.descriptor;
    await execRootWorkspaceBash(kernel, alice.sessionId, {
      command: "message send",
      stdin: JSON.stringify({
        chatId: room.chatId,
        content: invited.descriptor,
      }),
    });
    const bobRoomSnapshot = await getRuntime(kernel, bob.sessionId).readMessageChannel({
      chatId: room.chatId,
      limit: 10,
    });
    diagnostics.roomTruth = bobRoomSnapshot.items.map((item) => item.content);
    const accepted = await acceptTerminalSeat({
      kernel,
      sessionId: bob.sessionId,
      descriptor: invited.descriptor,
    });
    if (accepted.exitCode !== 0 || !accepted.payload) {
      throw new Error(`expected terminal accept to succeed: ${accepted.stderr || accepted.stdout}`);
    }
    diagnostics.acceptedStatus = accepted.payload.invitation?.status ?? null;
    diagnostics.acceptedRole = accepted.payload.access?.role ?? null;

    const marker = `pair-debug-${Date.now()}`;
    const wrote = await getRuntime(kernel, bob.sessionId).writeRuntimeTerminal({
      terminalId,
      text: `${marker}\r`,
      readRecordActivity: false,
    });
    if (!wrote.ok) {
      throw new Error(`expected writer seat to write: ${wrote.message}`);
    }
    diagnostics.marker = marker;
    diagnostics.bobTerminalText = await readTerminalText(kernel, bob.sessionId, terminalId);
    diagnostics.aliceTerminalText = await readTerminalText(kernel, alice.sessionId, terminalId);

    return {
      scenarioId: scenario.id,
      descriptorProjection: invited.projection,
      invitationStatus: invited.payload.invitation?.status ?? "unknown",
      acceptedStatus: accepted.payload.invitation?.status ?? "unknown",
      acceptedRole: accepted.payload.access?.role ?? "unknown",
      roomDescriptorVisible: kernel
        .snapshotGlobalRoom({ chatId: room.chatId, accessToken: room.accessToken, limit: 10 })
        .items.some((item) => item.content === invited.descriptor),
      bobCanReadDescriptorTransport: bobRoomSnapshot.items.some((item) => item.content === invited.descriptor),
      bobReadText: await readTerminalText(kernel, bob.sessionId, terminalId),
      aliceReadText: await readTerminalText(kernel, alice.sessionId, terminalId),
      marker,
    };
  } catch (error) {
    throw formatManagedSeatValidationFailure(scenario.id, error, diagnostics);
  } finally {
    await authority.stop();
    await kernel.stop();
    rmSync(root, { recursive: true, force: true });
  }
};

export const runManagedSeatLifecycleMutationScenario = async (
  scenario: ManagedSeatScenarioDefinition,
): Promise<ManagedSeatLifecycleMutationResult> => {
  const { root, workspace, kernel } = await createKernel("lifecycle");
  const authority = await startManagedSeatAuthorityServer(kernel);
  const diagnostics: Record<string, unknown> = {
    scenarioId: scenario.id,
    situationBrief: buildManagedSeatSituationBrief(scenario),
    topology: scenario.topology,
    terminalAuthorityUrl: authority.authorityUrl,
  };
  try {
    const alice = await createSessionContext(kernel, workspace, "alice-lifecycle");
    const bob = await createSessionContext(kernel, workspace, "bob-lifecycle");
    const charlie = await createSessionContext(kernel, workspace, "charlie-lifecycle");

    const created = await kernel.createGlobalTerminal({
      terminalId: "lifecycle-terminal",
      processKind: "shell",
      command: ["sh", "-lc", "cat"],
      actorId: alice.principalId,
    });
    const terminalId = created.terminal?.terminalId;
    if (!created.ok || !terminalId) {
      throw new Error("expected lifecycle terminal");
    }
    diagnostics.terminalId = terminalId;

    const acceptedInvite = await inviteTerminalSeat({
      kernel,
      sessionId: alice.sessionId,
      terminalId,
      participantId: bob.principalId,
      seatClass: "RW",
      authorityUrl: authority.authorityUrl,
    });
    diagnostics.acceptedInvitationStatus = acceptedInvite.payload.invitation?.status ?? null;
    const accepted = await acceptTerminalSeat({
      kernel,
      sessionId: bob.sessionId,
      descriptor: acceptedInvite.descriptor,
    });
    if (accepted.exitCode !== 0) {
      throw new Error(`expected accepted seat: ${accepted.stderr || accepted.stdout}`);
    }
    diagnostics.acceptedStatus = accepted.payload?.invitation?.status ?? null;
    diagnostics.acceptedRole = accepted.payload?.access?.role ?? null;
    const firstMarker = `lifecycle-before-config-${Date.now()}`;
    const firstWrite = await getRuntime(kernel, bob.sessionId).writeRuntimeTerminal({
      terminalId,
      text: `${firstMarker}\r`,
      readRecordActivity: false,
    });
    if (!firstWrite.ok) {
      throw new Error(`expected initial writer seat: ${firstWrite.message}`);
    }
    diagnostics.firstMarker = firstMarker;

    const configResult = await execRootWorkspaceBash(kernel, alice.sessionId, {
      command: "terminal-manage config",
      stdin: JSON.stringify({
        terminalId,
        participantId: bob.principalId,
        seatClass: "RO",
        authorityUrl: authority.authorityUrl,
      }),
    });
    if (configResult.exitCode !== 0) {
      throw new Error(`terminal-manage config failed: ${configResult.stderr || configResult.stdout}`);
    }
    const configPayload = parseJson<ManagedSeatConfigPayload>(configResult.stdout);
    diagnostics.configResult = configPayload;

    const deniedWrite = await getRuntime(kernel, bob.sessionId).writeRuntimeTerminal({
      terminalId,
      text: `should-fail-${Date.now()}\r`,
      readRecordActivity: false,
    });
    diagnostics.writeAfterConfig = deniedWrite;
    diagnostics.bobTerminalText = await readTerminalText(kernel, bob.sessionId, terminalId);

    const expiredInvite = await inviteTerminalSeat({
      kernel,
      sessionId: alice.sessionId,
      terminalId,
      participantId: charlie.principalId,
      seatClass: "RW",
      authorityUrl: authority.authorityUrl,
      expiresAt: Date.now() - 1_000,
    });
    diagnostics.expiredInvitation = expiredInvite.payload.invitation ?? null;
    const expiredAccept = await acceptTerminalSeat({
      kernel,
      sessionId: charlie.sessionId,
      descriptor: expiredInvite.descriptor,
    });
    diagnostics.expiredAccept = {
      exitCode: expiredAccept.exitCode,
      stderr: expiredAccept.stderr,
      stdout: expiredAccept.stdout,
    };

    const firstPending = await inviteTerminalSeat({
      kernel,
      sessionId: alice.sessionId,
      terminalId,
      participantId: charlie.principalId,
      seatClass: "RW",
      authorityUrl: authority.authorityUrl,
      expiresAt: Date.now() + 10_000,
    });
    const renewedPending = await inviteTerminalSeat({
      kernel,
      sessionId: alice.sessionId,
      terminalId,
      participantId: charlie.principalId,
      seatClass: "RW",
      authorityUrl: authority.authorityUrl,
      expiresAt: Date.now() + 60_000,
    });
    diagnostics.firstPendingInvitation = firstPending.payload.invitation ?? null;
    diagnostics.renewedPendingInvitation = renewedPending.payload.invitation ?? null;

    const staleAccept = await acceptTerminalSeat({
      kernel,
      sessionId: charlie.sessionId,
      descriptor: firstPending.descriptor,
    });
    diagnostics.staleAccept = {
      exitCode: staleAccept.exitCode,
      stderr: staleAccept.stderr,
      stdout: staleAccept.stdout,
    };

    const revokeResult = await execRootWorkspaceBash(kernel, alice.sessionId, {
      command: "terminal-manage revoke",
      stdin: JSON.stringify({
        terminalId,
        participantId: charlie.principalId,
        authorityUrl: authority.authorityUrl,
      }),
    });
    if (revokeResult.exitCode !== 0) {
      throw new Error(`terminal-manage revoke failed: ${revokeResult.stderr || revokeResult.stdout}`);
    }
    diagnostics.revokeResult = revokeResult.stdout || revokeResult.stderr;

    const revokedAccept = await acceptTerminalSeat({
      kernel,
      sessionId: charlie.sessionId,
      descriptor: renewedPending.descriptor,
    });
    diagnostics.revokedAccept = {
      exitCode: revokedAccept.exitCode,
      stderr: revokedAccept.stderr,
      stdout: revokedAccept.stdout,
    };

    return {
      scenarioId: scenario.id,
      reconfiguredRole: configPayload.result?.role ?? configPayload.result?.accessRole ?? "unknown",
      writeAfterConfigOk: deniedWrite.ok,
      readAfterConfigContainsMarker: (await readTerminalText(kernel, bob.sessionId, terminalId)).includes(firstMarker),
      expiredAcceptError: `${expiredAccept.stderr}${expiredAccept.stdout}`,
      renewedExpiresAt: renewedPending.payload.invitation?.expiresAt ?? 0,
      firstExpiresAt: firstPending.payload.invitation?.expiresAt ?? 0,
      staleAcceptError: `${staleAccept.stderr}${staleAccept.stdout}`,
      revokedAcceptError: `${revokedAccept.stderr}${revokedAccept.stdout}`,
    };
  } catch (error) {
    throw formatManagedSeatValidationFailure(scenario.id, error, diagnostics);
  } finally {
    await authority.stop();
    await kernel.stop();
    rmSync(root, { recursive: true, force: true });
  }
};

export const runManagedSeatManagementHandoffScenario = async (
  scenario: ManagedSeatScenarioDefinition,
): Promise<ManagedSeatManagementHandoffResult> => {
  const { root, workspace, kernel } = await createKernel("management");
  const authority = await startManagedSeatAuthorityServer(kernel);
  const diagnostics: Record<string, unknown> = {
    scenarioId: scenario.id,
    situationBrief: buildManagedSeatSituationBrief(scenario),
    topology: scenario.topology,
    terminalAuthorityUrl: authority.authorityUrl,
  };
  try {
    const alice = await createSessionContext(kernel, workspace, "alice-management");
    const bob = await createSessionContext(kernel, workspace, "bob-management");

    const created = await kernel.createGlobalTerminal({
      terminalId: "management-terminal",
      processKind: "shell",
      command: ["sh", "-lc", "cat"],
      actorId: alice.principalId,
    });
    const terminalId = created.terminal?.terminalId;
    if (!created.ok || !terminalId) {
      throw new Error("expected management terminal");
    }
    diagnostics.terminalId = terminalId;

    const invite = await inviteTerminalSeat({
      kernel,
      sessionId: alice.sessionId,
      terminalId,
      participantId: bob.principalId,
      seatClass: "TM",
      authorityUrl: authority.authorityUrl,
    });
    diagnostics.invitationStatus = invite.payload.invitation?.status ?? null;
    const accepted = await acceptTerminalSeat({
      kernel,
      sessionId: bob.sessionId,
      descriptor: invite.descriptor,
    });
    if (accepted.exitCode !== 0 || !accepted.payload) {
      throw new Error(`expected TM accept to succeed: ${accepted.stderr || accepted.stdout}`);
    }
    diagnostics.acceptedRole = accepted.payload.access?.role ?? null;

    const actorView = kernel.listGlobalTerminals({ actorId: alice.principalId }).find((entry) => entry.terminalId === terminalId);
    const aliceActor = actorView?.actors?.find((actor) => actor.actorId === alice.principalId);
    const bobActor = actorView?.actors?.find((actor) => actor.actorId === bob.principalId);
    diagnostics.actorView = actorView?.actors ?? [];

    return {
      scenarioId: scenario.id,
      acceptedRole: accepted.payload.access?.role ?? "unknown",
      aliceCurrentAdmin: aliceActor?.currentAdmin ?? false,
      bobCurrentAdmin: bobActor?.currentAdmin ?? false,
      bobAdminCandidateRank: bobActor?.adminCandidateRank ?? null,
      currentAdminCount: actorView?.actors?.filter((actor) => actor.currentAdmin).length ?? 0,
    };
  } catch (error) {
    throw formatManagedSeatValidationFailure(scenario.id, error, diagnostics);
  } finally {
    await authority.stop();
    await kernel.stop();
    rmSync(root, { recursive: true, force: true });
  }
};

export const runManagedSeatCrossInstanceScenario = async (
  scenario: ManagedSeatScenarioDefinition,
): Promise<ManagedSeatCrossInstanceResult> => {
  const left = await createKernel("cross-a");
  const right = await createKernel("cross-b");
  const authorityA = await startManagedSeatAuthorityServer(left.kernel);
  const authorityB = await startManagedSeatAuthorityServer(right.kernel);
  const diagnostics: Record<string, unknown> = {
    scenarioId: scenario.id,
    situationBrief: buildManagedSeatSituationBrief(scenario),
    topology: scenario.topology,
    roomAuthorityUrl: authorityA.authorityUrl,
    terminalAuthorityUrl: authorityB.authorityUrl,
  };
  try {
    const alice = await createSessionContext(left.kernel, left.workspace, "alice-cross");
    const bob = await createSessionContext(right.kernel, right.workspace, "bob-cross");

    const room = await left.kernel.createGlobalRoom({
      title: "cross-instance-room",
      initialUsers: [{ contactId: alice.principalId, label: "Alice", role: "admin", focused: true }],
    });
    diagnostics.roomChatId = room.chatId;
    const roomInvite = await inviteRoomSeat({
      kernel: left.kernel,
      sessionId: alice.sessionId,
      chatId: room.chatId,
      participantId: bob.principalId,
      authorityUrl: authorityA.authorityUrl,
    });
    diagnostics.roomInviteProjection = roomInvite.projection;
    diagnostics.roomInviteDescriptor = roomInvite.descriptor;
    const acceptedRoom = await acceptRoomSeat({
      kernel: right.kernel,
      sessionId: bob.sessionId,
      descriptor: roomInvite.descriptor,
    });
    if (acceptedRoom.exitCode !== 0 || !acceptedRoom.payload) {
      throw new Error(`expected remote room accept: ${acceptedRoom.stderr || acceptedRoom.stdout}`);
    }
    diagnostics.roomInviteAcceptedStatus = acceptedRoom.payload.invitation?.status ?? null;

    const roomMarker = `cross-room-${Date.now()}`;
    const sentRoomMessage = await execRootWorkspaceBash(right.kernel, bob.sessionId, {
      command: "message send",
      stdin: JSON.stringify({
        chatId: room.chatId,
        content: roomMarker,
      }),
    });
    if (sentRoomMessage.exitCode !== 0) {
      throw new Error(`expected remote room send: ${sentRoomMessage.stderr || sentRoomMessage.stdout}`);
    }
    diagnostics.roomMarker = roomMarker;

    const terminalResult = await right.kernel.createGlobalTerminal({
      terminalId: "cross-instance-terminal",
      processKind: "shell",
      command: ["sh", "-lc", "cat"],
      actorId: bob.principalId,
    });
    const terminalId = terminalResult.terminal?.terminalId;
    if (!terminalResult.ok || !terminalId) {
      throw new Error("expected remote terminal creation");
    }
    diagnostics.terminalId = terminalId;

    const terminalInvite = await inviteTerminalSeat({
      kernel: right.kernel,
      sessionId: bob.sessionId,
      terminalId,
      participantId: alice.principalId,
      seatClass: "RW",
      authorityUrl: authorityB.authorityUrl,
    });
    diagnostics.terminalInviteProjection = terminalInvite.projection;
    diagnostics.terminalInviteDescriptor = terminalInvite.descriptor;
    const sendDescriptor = await execRootWorkspaceBash(right.kernel, bob.sessionId, {
      command: "message send",
      stdin: JSON.stringify({
        chatId: room.chatId,
        content: terminalInvite.descriptor,
      }),
    });
    if (sendDescriptor.exitCode !== 0) {
      throw new Error(`expected descriptor relay through remote room: ${sendDescriptor.stderr || sendDescriptor.stdout}`);
    }

    const aliceRoomSnapshot = await getRuntime(left.kernel, alice.sessionId).readMessageChannel({
      chatId: room.chatId,
      limit: 20,
    });
    diagnostics.roomTruth = aliceRoomSnapshot.items.map((item) => item.content);
    const acceptedTerminal = await acceptTerminalSeat({
      kernel: left.kernel,
      sessionId: alice.sessionId,
      descriptor: terminalInvite.descriptor,
    });
    if (acceptedTerminal.exitCode !== 0 || !acceptedTerminal.payload) {
      throw new Error(`expected remote terminal accept: ${acceptedTerminal.stderr || acceptedTerminal.stdout}`);
    }
    diagnostics.terminalInviteAcceptedStatus = acceptedTerminal.payload.invitation?.status ?? null;

    const marker = `cross-terminal-${Date.now()}`;
    const writeResult = await getRuntime(left.kernel, alice.sessionId).writeRuntimeTerminal({
      terminalId,
      text: `${marker}\r`,
      readRecordActivity: false,
    });
    if (!writeResult.ok) {
      throw new Error(`expected remote terminal write: ${writeResult.message}`);
    }
    diagnostics.marker = marker;
    diagnostics.aliceRemoteTerminalText = await readTerminalText(left.kernel, alice.sessionId, terminalId);
    diagnostics.bobLocalTerminalText = await readTerminalText(right.kernel, bob.sessionId, terminalId);

    return {
      scenarioId: scenario.id,
      roomInviteAcceptedStatus: acceptedRoom.payload.invitation?.status ?? "unknown",
      roomRelayVisibleOnAlice: aliceRoomSnapshot.items.some((item) => item.content === roomMarker),
      terminalInviteAcceptedStatus: acceptedTerminal.payload.invitation?.status ?? "unknown",
      marker,
      aliceRemoteReadText: await readTerminalText(left.kernel, alice.sessionId, terminalId),
      bobLocalReadText: await readTerminalText(right.kernel, bob.sessionId, terminalId),
      roomAuthorityUrl: authorityA.authorityUrl,
      terminalAuthorityUrl: authorityB.authorityUrl,
    };
  } catch (error) {
    throw formatManagedSeatValidationFailure(scenario.id, error, diagnostics);
  } finally {
    await authorityA.stop();
    await authorityB.stop();
    await left.kernel.stop();
    await right.kernel.stop();
    rmSync(left.root, { recursive: true, force: true });
    rmSync(right.root, { recursive: true, force: true });
  }
};
