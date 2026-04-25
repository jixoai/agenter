import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AttentionSystem } from "@agenter/attention-system";
import { generatePrincipalKeyPair } from "@agenter/principal-crypto";
import { MessageControlPlane, resolveMessageControlDbPath } from "@agenter/message-system";

import {
  RUNTIME_SKILL_CONTEXT_ID,
  RUNTIME_SKILL_CONTEXT_TEMPLATE,
  RUNTIME_SKILL_DEFAULT_TARGET,
  RUNTIME_SKILL_SNAPSHOT_TARGET,
  type RuntimeSkillRefreshResult,
} from "../src/runtime-skill-system";
import { RuntimeKernelHost } from "../src/runtime-kernel-host";
import { RuntimeMessageKernelAdapter } from "../src/runtime-system-kernel-adapters/message-adapter";
import { RuntimeSkillKernelAdapter } from "../src/runtime-system-kernel-adapters/skill-adapter";
import { RuntimeTerminalKernelAdapter } from "../src/runtime-system-kernel-adapters/terminal-adapter";
import type { RuntimeSystemIngressEnvelope } from "../src/runtime-system-kernel-adapters/types";

const createRoomId = (): string => generatePrincipalKeyPair().principalId;

describe("Feature: runtime-system-kernel-adapters integration", () => {
  test("Scenario: Given message terminal and skill systems When they publish work Then all ingress enters the kernel through the same host contract", async () => {
    const attention = new AttentionSystem();
    const committedEnvelopes: RuntimeSystemIngressEnvelope[] = [];
    const host = new RuntimeKernelHost({
      commitIngress: async (envelope) => {
        committedEnvelopes.push(envelope);
        attention.getContext(envelope.contextKey) ??
          attention.createContext({ contextId: envelope.contextKey, owner: envelope.author });
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
    const messageActorId = "session:avatar";
    const room = plane.createChannel({
      chatId: createRoomId(),
      kind: "room",
      owner: "avatar",
      participants: [{ id: "auth:user", label: "User" }],
      bootstrapActorId: messageActorId,
    });
    const inbound = plane.send({
      chatId: room.chatId,
      from: "User",
      kind: "text",
      content: "hello from room",
      senderActorId: "auth:user",
    });
    const messageAdapter = new RuntimeMessageKernelAdapter({
      messageSystem: plane,
      messageActorId,
      isLoopPaused: () => false,
      getMaxFocusedRoomCount: () => 3,
      getMaxBatchReadRoomMessageCount: () => 20,
      getActorRoom: (chatId) => (chatId === room.chatId ? room : undefined),
      isUnreadInboundMessage: (message) => message.kind === "text" && message.unreadActorIds.includes(messageActorId),
      buildMessageIngressEnvelope: ({ message, channel }) => ({
        system: "message",
        sourceId: `msg:${channel.chatId}/${message.messageId}`,
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
      getTerminalContextId: (terminalId) => `ctx-terminal-${terminalId}`,
      readTerminalIngress: async () => ({
        system: "terminal",
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
      onTerminalActivitySignal: () => {},
    });

    const ensureSkillContext = () => {
      if (!attention.getContext(RUNTIME_SKILL_CONTEXT_ID)) {
        attention.createContext({
          contextId: RUNTIME_SKILL_CONTEXT_ID,
          owner: "avatar",
          focusState: "background",
          template: RUNTIME_SKILL_CONTEXT_TEMPLATE,
          slots: {
            [RUNTIME_SKILL_DEFAULT_TARGET]: "",
            [RUNTIME_SKILL_SNAPSHOT_TARGET]: "",
          },
        });
      }
    };
    const skillAdapter = new RuntimeSkillKernelAdapter({
      ensureAttentionContext: ensureSkillContext,
      getBootstrapContext: () => {
        const context = attention.getContext(RUNTIME_SKILL_CONTEXT_ID);
        return context
          ? {
              contextId: RUNTIME_SKILL_CONTEXT_ID,
              context: context.getState(),
              recentCommits: context.listRecentCommits(),
            }
          : null;
      },
    });

    host.mountAdapter(messageAdapter);
    host.mountAdapter(terminalAdapter);
    host.mountAdapter(skillAdapter);

    terminalAdapter.markTerminalDirty("iflow");
    expect(await host.drainIngress()).toBe(2);

    const skillRefresh: RuntimeSkillRefreshResult = {
      contextId: RUNTIME_SKILL_CONTEXT_ID,
      skills: [],
      snapshot: "## skills.list",
      changedSkills: [],
      systemIngress: {
        system: "skill",
        sourceId: "skill:runtime:snapshot",
        contextKey: RUNTIME_SKILL_CONTEXT_ID,
        kind: "runtime_skill_snapshot",
        summary: "Refreshed runtime skill snapshot.",
        content: "## skills.list",
        format: "text/markdown",
        score: 0,
        tags: ["skill", "snapshot"],
        createdAt: 3,
        author: "avatar",
        target: RUNTIME_SKILL_SNAPSHOT_TARGET,
        commitMode: "system",
      },
      reminderIngresses: [],
      bootstrapPending: true,
    };
    await skillAdapter.applyRefreshResult(skillRefresh, { notifyLoop: false });

    expect(committedEnvelopes.map((envelope) => envelope.system)).toEqual(["message", "terminal", "skill"]);
    expect(attention.getContext(room.contextId ?? `ctx-${room.chatId}`)).toBeDefined();
    expect(attention.getContext("ctx-terminal-iflow")).toBeDefined();
    expect(attention.getContext(RUNTIME_SKILL_CONTEXT_ID)).toBeDefined();
    expect(inbound.messageId).toBeGreaterThan(0);
  });
});
