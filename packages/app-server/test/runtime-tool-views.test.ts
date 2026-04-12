import { describe, expect, test } from "bun:test";

import type { AttentionActiveContextMatch } from "@agenter/attention-system";
import type { MessageSnapshot } from "@agenter/message-system";
import type { TerminalControlPlaneEntry } from "@agenter/terminal-system";

import {
  projectRuntimeAttentionActiveMatch,
  projectRuntimeMessageSnapshot,
  projectRuntimeTerminal,
  projectRuntimeWorkspaceSurface,
} from "../src/runtime-tool-views";

describe("Feature: runtime tool public views", () => {
  test("Scenario: Given an active attention context When projected Then only summary facts survive the runtime CLI boundary", () => {
    const active = {
      contextId: "ctx-chat-main",
      context: {
        contextId: "ctx-chat-main",
        owner: "architect",
        focusState: "focused",
        content: "x".repeat(320),
        contentFormat: "text/plain",
        scoreMap: { delivery: 100, verify: 0 },
        consumedPushCommitIds: [],
        headCommitId: "commit-4",
        createdAt: "2026-04-11T00:00:00.000Z",
        updatedAt: "2026-04-11T00:03:00.000Z",
      },
      recentCommits: [1, 2, 3, 4].map((index) => ({
        commitId: `commit-${index}`,
        contextId: "ctx-chat-main",
        ingressType: "commit",
        parentCommitIds: index === 1 ? [] : [`commit-${index - 1}`],
        meta: {
          author: "architect",
          source: "runtime",
          systemId: "message",
          subjectId: "room-1",
          channelId: "room-1",
        },
        summary: `summary-${index}`,
        scores: { delivery: Math.max(0, 100 - index * 10) },
        change: {
          type: "update",
          value: `line-${index}`,
          format: "text/plain",
        },
        createdAt: `2026-04-11T00:0${index}:00.000Z`,
      })),
    } satisfies AttentionActiveContextMatch;

    const projected = projectRuntimeAttentionActiveMatch(active);

    expect(projected.context.unresolvedScoreCount).toBe(1);
    expect(projected.context.contentPreview).toContain("...<clipped");
    expect(projected.recentCommits).toHaveLength(3);
    expect(projected.recentCommits[0]?.commitId).toBe("commit-2");
    expect(Object.prototype.hasOwnProperty.call(projected.context, "content")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(projected.recentCommits[0] ?? {}, "change")).toBeFalse();
  });

  test("Scenario: Given message and terminal internals When projected Then runtime CLI views omit control-plane-only fields", () => {
    const snapshot = {
      channel: {
        chatId: "room-1",
        kind: "room",
        title: "Room",
        owner: "architect",
        contextId: "ctx-room-1",
        participants: [{ id: "session:user", label: "User" }],
        metadata: { builtIn: true },
        createdAt: 1,
        updatedAt: 2,
        focused: true,
        accessRole: "member",
        accessToken: "msgtok-secret",
        currentAdmin: true,
        transportUrl: "http://127.0.0.1/message/room-1",
        readProgress: {
          totalSeatCount: 1,
          readSeatCount: 1,
          unreadSeatCount: 0,
          invalidCredentialSeatCount: 0,
        },
        readStates: [
          {
            actorId: "session:user",
            role: "member",
            currentAdmin: false,
            online: true,
            focused: true,
            invalidCredential: false,
            trackedByLatestVisible: true,
            hasReadLatestVisible: true,
          },
        ],
      },
      items: [
        {
          rowId: 1,
          messageId: "msg-1",
          chatId: "room-1",
          from: "architect",
          kind: "text",
          content: "hello",
          createdAt: 10,
          updatedAt: 11,
          readActorIds: ["session:user"],
          unreadActorIds: [],
          metadata: { source: "message_send" },
        },
      ],
      nextBefore: null,
      hasMoreBefore: false,
      headVersion: "head-1",
    } satisfies MessageSnapshot;

    const terminal = {
      terminalId: "term-1",
      processKind: "shell",
      command: ["bash"],
      cwd: "/tmp/workspace",
      workspace: "/tmp/workspace",
      running: true,
      status: "IDLE",
      seq: 7,
      focused: true,
      title: "workspace",
      icon: ">_",
      rendererEngine: "xterm",
      transportUrl: "ws://127.0.0.1/terminal/term-1",
      approvalTimeoutMs: 30_000,
      pendingRequestCount: 2,
      access: {
        role: "writer",
        accessToken: "termtok-secret",
        currentAdmin: true,
      },
      actors: [
        {
          actorId: "session:user",
          role: "writer",
          currentAdmin: true,
          online: true,
          focused: true,
        },
      ],
    } satisfies TerminalControlPlaneEntry;

    const projectedSnapshot = projectRuntimeMessageSnapshot(snapshot);
    const projectedSnapshotWithDirectory = projectRuntimeMessageSnapshot(snapshot, {
      visibleRooms: [
        {
          chatId: "room-2",
          title: "gaubee",
          participantLabels: ["User", "gaubee"],
          focused: false,
        },
      ],
      reachableParticipants: [
        {
          label: "gaubee",
          rooms: [
            {
              chatId: "room-2",
              title: "gaubee",
              participantLabels: ["User", "gaubee"],
              focused: false,
            },
          ],
        },
      ],
    });
    const projectedTerminal = projectRuntimeTerminal(terminal);
    const projectedWorkspace = projectRuntimeWorkspaceSurface({
      mount: {
        mountId: "mount-1",
        runtimeId: "runtime-1",
        workspaceId: "workspace-1",
        workspacePath: "/tmp/workspace",
        kind: "workspace",
        createdAt: "2026-04-11T00:00:00.000Z",
        updatedAt: "2026-04-11T00:00:00.000Z",
      },
      grants: [
        {
          grantId: "grant-1",
          mountId: "mount-1",
          workspacePath: "/tmp/workspace",
          relativePath: "/",
          absolutePath: "/tmp/workspace",
          mode: "rw",
          createdAt: "2026-04-11T00:00:00.000Z",
        },
      ],
    });

    expect(projectedSnapshot.channel.chatId).toBe("room-1");
    expect(projectedSnapshot.channel.presence?.totalSeatCount).toBe(1);
    expect(projectedSnapshot.items[0]?.content).toBe("hello");
    expect(projectedSnapshot.directory).toBeUndefined();
    expect(projectedSnapshotWithDirectory.directory?.visibleRooms[0]?.title).toBe("gaubee");
    expect(projectedSnapshotWithDirectory.directory?.reachableParticipants[0]?.label).toBe("gaubee");
    expect(Object.prototype.hasOwnProperty.call(projectedSnapshot.channel, "owner")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(projectedSnapshot.channel, "metadata")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(projectedSnapshot.channel, "readStates")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(projectedSnapshot.items[0] ?? {}, "readActorIds")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(projectedSnapshot.items[0] ?? {}, "unreadActorIds")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(projectedSnapshot.items[0] ?? {}, "metadata")).toBeFalse();

    expect(projectedTerminal.terminalId).toBe("term-1");
    expect(projectedTerminal.cwd).toBe("/tmp/workspace");
    expect(Object.prototype.hasOwnProperty.call(projectedTerminal, "transportUrl")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(projectedTerminal, "access")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(projectedTerminal, "actors")).toBeFalse();

    expect(projectedWorkspace.mount.workspacePath).toBe("/tmp/workspace");
    expect(projectedWorkspace.mount.kind).toBe("workspace");
    expect(projectedWorkspace.grants[0]?.absolutePath).toBe("/tmp/workspace");
    expect(Object.prototype.hasOwnProperty.call(projectedWorkspace.mount, "mountId")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(projectedWorkspace.grants[0] ?? {}, "grantId")).toBeFalse();
  });
});
