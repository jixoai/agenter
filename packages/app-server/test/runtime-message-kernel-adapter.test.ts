import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generatePrincipalKeyPair } from "@agenter/principal-crypto";
import { MessageControlPlane, resolveMessageControlDbPath, type MessageControlPlaneEntry } from "@agenter/message-system";

import { RuntimeMessageKernelAdapter } from "../src/runtime-system-kernel-adapters/message-adapter";
import type { RuntimeSystemIngressEnvelope, RuntimeSystemKernelHost } from "../src/runtime-system-kernel-adapters/types";

const createRoomId = (): string => generatePrincipalKeyPair().principalId;

describe("Feature: runtime-message-kernel-adapter", () => {
  test("Scenario: Given unread room ingress When adapter drains and cycle commits read acks Then message truth stays in the adapter layer", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-message-adapter-"));
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

    const adapter = new RuntimeMessageKernelAdapter({
      messageSystem: plane,
      messageActorId,
      isLoopPaused: () => false,
      getMaxFocusedRoomCount: () => 3,
      getMaxBatchReadRoomMessageCount: () => 20,
      getActorRoom: (chatId) => (chatId === room.chatId ? room : undefined),
      isUnreadInboundMessage: (message) => message.kind === "text" && message.unreadActorIds.includes(messageActorId),
      buildMessageIngressEnvelope: ({ message, channel }) => ({
        system: "message",
        boundaryChannel: "world_fact",
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

    const envelopes = adapter.drainIngress();

    expect(envelopes).toEqual([
      {
        system: "message",
        boundaryChannel: "world_fact",
        sourceId: `msg:${room.chatId}/${inbound.messageId}`,
        contextKey: room.contextId ?? `ctx-${room.chatId}`,
        kind: "room_ingress",
        summary: "hello from room",
        content: "hello from room",
        format: "text/plain",
        score: 100,
        tags: ["message"],
        createdAt: inbound.createdAt,
        author: "User",
      },
    ]);
    expect(plane.listUnreadRoomSummaries(messageActorId)).toHaveLength(1);

    adapter.beginCycle();
    await adapter.commitActiveCycleReadAcks();

    expect(plane.listUnreadRoomSummaries(messageActorId)).toHaveLength(0);
  });

  test("Scenario: Given room lifecycle ingress before host boot When adapter bootstraps Then lifecycle commits flush through the host API", async () => {
    const committed: RuntimeSystemIngressEnvelope[] = [];
    const adapter = new RuntimeMessageKernelAdapter({
      messageSystem: new MessageControlPlane({
        dbPath: resolveMessageControlDbPath(join(mkdtempSync(join(tmpdir(), "agenter-message-adapter-")), ".message")),
      }),
      messageActorId: "session:avatar",
      isLoopPaused: () => false,
      getMaxFocusedRoomCount: () => 3,
      getMaxBatchReadRoomMessageCount: () => 20,
      getActorRoom: () => undefined,
      isUnreadInboundMessage: () => false,
      buildMessageIngressEnvelope: () => null,
      onCompactMessage: () => {},
      queueCompactCycle: () => {},
      onError: (message) => {
        throw new Error(message);
      },
    });
    const envelope: RuntimeSystemIngressEnvelope = {
      system: "message",
      boundaryChannel: "scheduler_signal",
      sourceId: "msg:room-alpha",
      contextKey: "ctx-room-alpha",
      kind: "channel_focus",
      summary: "Focused room",
      content: "focused: true",
      format: "text/plain",
      score: 10,
      tags: ["message", "lifecycle"],
      createdAt: 1,
      author: "avatar",
    };
    const host: RuntimeSystemKernelHost = {
      registerCommitRef: (input) => ({ ...input, createdAt: 1 }),
      getDeliveryProjection: () => null,
      listDeliveryProjections: () => [],
      queryAttentionDeliveryTimeline: () => ({ dispatches: [], receipts: [] }),
      signalIngress: () => {},
      commitIngress: async (input) => {
        committed.push(input);
        return null;
      },
    };

    adapter.commitLifecycleIngress(envelope);
    adapter.mount(host);
    await adapter.bootstrap();

    expect(committed).toEqual([envelope]);
  });
});
