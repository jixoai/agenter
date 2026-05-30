import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AttentionSystem } from "@agenter/attention-system";
import { MessageControlPlane, resolveMessageControlDbPath } from "@agenter/message-system";
import { generatePrincipalKeyPair } from "@agenter/principal-crypto";

import { RuntimeKernelHost } from "../src/runtime-kernel-host";
import type { RuntimeSkillRefreshResult } from "../src/runtime-skill-system";
import { RuntimeMessageKernelAdapter } from "../src/runtime-system-kernel-adapters/message-adapter";
import { RuntimeSkillKernelAdapter } from "../src/runtime-system-kernel-adapters/skill-adapter";
import { RuntimeTerminalKernelAdapter } from "../src/runtime-system-kernel-adapters/terminal-adapter";
import type { RuntimeSystemIngressEnvelope } from "../src/runtime-system-kernel-adapters/types";

const createRoomId = (): string => generatePrincipalKeyPair().principalId;
const RUNTIME_SKILL_PUBLISH_CONTEXT_ID = "ctx-workspace-runtime";

describe("Feature: runtime-system-kernel-adapters integration", () => {
  test("Scenario: Given message terminal and skill systems When they publish work Then all ingress enters the kernel through the same host contract", async () => {
    const attention = new AttentionSystem();
    const committedEnvelopes: RuntimeSystemIngressEnvelope[] = [];
    const host = new RuntimeKernelHost({
      commitIngress: async (envelope) => {
        committedEnvelopes.push(envelope);
        attention.getContext(envelope.contextKey) ??
          attention.createContext({
            contextId: envelope.contextKey,
            owner: envelope.author,
            focusState: envelope.system === "skill" ? "background" : "focused",
          });
        const action =
          envelope.commitMode === "system" ? attention.commitSystem.bind(attention) : attention.commit.bind(attention);
        const { commit } = action(envelope.contextKey, {
          target: envelope.target,
          ingressType: envelope.ingressType,
          meta: {
            author: envelope.author,
            source: envelope.system,
            src: envelope.sourceId,
            tags: envelope.tags,
            createdAt: new Date(envelope.createdAt).toISOString(),
          },
          scores: envelope.score ? { seed: envelope.score } : {},
          summary: envelope.summary,
          change: {
            type: envelope.changeType ?? "update",
            value: envelope.content,
            format: envelope.format,
          },
        });
        return {
          contextId: envelope.contextKey,
          commit,
        };
      },
      getAttentionCommit: (input) => attention.getContext(input.contextId)?.getCommit(input.commitId) ?? null,
      getAttentionContextState: (contextId) => attention.getContext(contextId)?.getState() ?? null,
    });

    const root = mkdtempSync(join(tmpdir(), "agenter-adapter-integration-"));
    const plane = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(join(root, ".message")),
    });
    const messageContactId = "session:avatar";
    const room = plane.createChannel({
      chatId: createRoomId(),
      kind: "room",
      owner: "avatar",
      participants: [{ id: "auth:user", label: "User" }],
      bootstrapContactId: messageContactId,
    });
    const inbound = plane.send({
      chatId: room.chatId,
      from: "User",
      kind: "text",
      content: "hello from room",
      senderContactId: "auth:user",
    });
    const messageAdapter = new RuntimeMessageKernelAdapter({
      messageSystem: plane,
      messageContactId,
      isLoopPaused: () => false,
      getMaxFocusedRoomCount: () => 3,
      getMaxBatchReadRoomMessageCount: () => 20,
      getActorRoom: (chatId) => (chatId === room.chatId ? room : undefined),
      isUnreadInboundMessage: (message) =>
        message.kind === "text" && message.unreadContactIds.includes(messageContactId),
      buildMessageIngressEnvelope: ({ message, channel }) => ({
        system: "message",
        boundaryChannel: "world_fact",
        sourceId: `room:${channel.chatId}#${message.messageId}`,
        contextKey: channel.contextId ?? `ctx-${channel.chatId}`,
        kind: "room_ingress",
        summary: message.content,
        content: message.content,
        format: "text/plain",
        score: 100,
        tags: ["message"],
        createdAt: message.createdAt,
        author: message.from,
      }),
      onCompactMessage: () => {},
      queueCompactCycle: () => {},
      onError: (message) => {
        throw new Error(message);
      },
    });

    const terminalAdapter = new RuntimeTerminalKernelAdapter({
      isLoopPaused: () => false,
      listFocusedTerminalIds: () => ["iflow"],
      isTerminalRunning: () => true,
      getTerminalStatus: () => "IDLE",
      getTerminalHeadHash: async () => null,
      getTerminalReadCursorHash: () => null,
      getTerminalContextId: (terminalId) => `ctx-terminal-${terminalId}`,
      isTerminalActionable: () => false,
      readTerminalIngress: async () => ({
        system: "terminal",
        boundaryChannel: "world_fact",
        sourceId: "tty:iflow",
        contextKey: "ctx-terminal-iflow",
        kind: "terminal_snapshot",
        summary: "Terminal iflow: echo ready",
        content: "```text\necho ready\n```",
        format: "text/markdown",
        score: 0,
        tags: ["terminal"],
        createdAt: 2,
        author: "terminal:iflow",
      }),
      buildLifecycleIngressEnvelope: (input) => ({
        system: "terminal",
        boundaryChannel: "scheduler_signal",
        sourceId: `tty:${input.terminalId}`,
        contextKey: input.contextId,
        kind: input.event,
        summary: input.summary,
        content: input.summary,
        format: "text/plain",
        score: input.score ?? 0,
        tags: ["terminal", "lifecycle"],
        createdAt: 2,
        author: "avatar",
      }),
      onTerminalActionableSignal: () => {},
    });

    const skillAdapter = new RuntimeSkillKernelAdapter();

    host.mountAdapter(messageAdapter);
    host.mountAdapter(terminalAdapter);
    host.mountAdapter(skillAdapter);

    terminalAdapter.markTerminalDirty("iflow");
    expect(await host.drainIngress()).toBe(1);

    const skillRefresh: RuntimeSkillRefreshResult = {
      skills: [],
      snapshot: "## skills.list",
      changedSkills: [],
      publishedIngresses: [
        {
          system: "skill",
          boundaryChannel: "capability_projection",
          sourceId: "skill:runtime:snapshot",
          contextKey: RUNTIME_SKILL_PUBLISH_CONTEXT_ID,
          kind: "runtime_skill_snapshot",
          summary: "Refreshed runtime skill snapshot.",
          content: "## skills.list",
          format: "text/markdown",
          score: 0,
          tags: ["skill", "snapshot"],
          createdAt: 3,
          author: "avatar",
          commitMode: "system",
        },
      ],
    };
    await skillAdapter.applyRefreshResult(skillRefresh, { notifyLoop: false });

    expect(committedEnvelopes.map((envelope) => envelope.system)).toEqual(["message", "skill"]);
    expect(attention.getContext(room.contextId ?? `ctx-${room.chatId}`)).toBeDefined();
    expect(attention.getContext("ctx-terminal-iflow")).toBeUndefined();
    expect(attention.getContext(RUNTIME_SKILL_PUBLISH_CONTEXT_ID)?.getState().focusState).toBe("background");
    expect(inbound.messageId).toBeGreaterThan(0);
  });
});
