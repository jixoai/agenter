import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MessageControlPlane, type MessageTransportServerMessage } from "../src";

const createPlane = (): MessageControlPlane => {
  const root = mkdtempSync(join(tmpdir(), "agenter-message-system-"));
  return new MessageControlPlane({ dbPath: join(root, "chat.db") });
};

const createChannel = (plane: MessageControlPlane, input: { chatId?: string; kind?: "direct" | "room" } = {}) =>
  plane.createChannel({
    chatId: input.chatId ?? "chat-kzf",
    kind: input.kind ?? "direct",
    owner: "jane",
    participants: [{ id: "avatar:jane" }, { id: "user:kzf" }],
  });

const toHttpUrl = (url: string): string => url.replace(/^ws:/, "http:");

const waitForSocketOutcome = async (
  socket: WebSocket,
): Promise<
  | { type: "message"; payload: MessageTransportServerMessage }
  | { type: "close"; code: number }
  | { type: "error" }
> =>
  await new Promise((resolve) => {
    socket.addEventListener("message", (event) => {
      resolve({
        type: "message",
        payload: JSON.parse(String(event.data)) as MessageTransportServerMessage,
      });
    });
    socket.addEventListener("close", (event) => {
      resolve({ type: "close", code: event.code });
    });
    socket.addEventListener("error", () => {
      resolve({ type: "error" });
    });
  });

describe("Feature: message-chat-control-plane", () => {
  test("Scenario: Given direct and room channels When created and listed Then canonical prefixes and reusable bootstrap access stay stable", () => {
    const plane = createPlane();
    const direct = createChannel(plane, { chatId: "chat-kzf" });
    const room = createChannel(plane, { chatId: "room-team", kind: "room" });

    expect(direct.chatId).toBe("chat-kzf");
    expect(room.chatId).toBe("room-team");
    expect(direct.accessRole).toBe("admin");
    expect(direct.accessToken).toStartWith("msgtok_");
    expect(() => plane.createChannel({ chatId: "chat-bad-room", kind: "room" })).toThrow(
      "invalid chat id prefix for room: chat-bad-room",
    );

    const listed = plane.listChannels();
    expect(listed[0]?.accessRole).toBe("admin");
    expect(listed.find((item) => item.chatId === "chat-kzf")?.accessToken).toBe(direct.accessToken);
  });

  test("Scenario: Given long chat history When reverse paging runs Then oldest cursor advances correctly", () => {
    const plane = createPlane();
    createChannel(plane, { chatId: "chat-kzf" });
    for (let index = 0; index < 5; index += 1) {
      plane.send({
        chatId: "chat-kzf",
        from: `user:${index}`,
        content: `message-${index}`,
        createdAt: 1000 + index,
      });
    }

    const firstPage = plane.queryMessages({ chatId: "chat-kzf", limit: 2 });
    expect(firstPage.items.map((item) => item.content)).toEqual(["message-3", "message-4"]);
    expect(firstPage.hasMoreBefore).toBe(true);

    const secondPage = plane.queryMessages({ chatId: "chat-kzf", limit: 2, before: firstPage.nextBefore });
    expect(secondPage.items.map((item) => item.content)).toEqual(["message-1", "message-2"]);
  });

  test("Scenario: Given readonly member and admin channel grants When authorized APIs run Then each role follows the same access matrix", () => {
    const plane = createPlane();
    const channel = createChannel(plane);

    const readonly = plane.issueChannelGrantAuthorized({
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      role: "readonly",
      label: "QA viewer",
    });
    const member = plane.issueChannelGrantAuthorized({
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      role: "member",
      label: "Relay member",
    });

    const readonlySnapshot = plane.snapshotAuthorized({
      chatId: channel.chatId,
      accessToken: readonly.accessToken,
    });
    expect(readonlySnapshot.channel.accessRole).toBe("readonly");
    expect(readonlySnapshot.channel.accessToken).toBe(readonly.accessToken);
    expect(() =>
      plane.sendAuthorized({
        chatId: channel.chatId,
        accessToken: readonly.accessToken,
        from: "user:kzf",
        content: "blocked",
      }),
    ).toThrow("message channel member access required");

    const sent = plane.sendAuthorized({
      chatId: channel.chatId,
      accessToken: member.accessToken,
      from: "user:kzf",
      content: "member message",
    });
    expect(sent.content).toBe("member message");
    expect(() =>
      plane.updateChannelAuthorized({
        chatId: channel.chatId,
        accessToken: member.accessToken,
        patch: { title: "Nope" },
      }),
    ).toThrow("message channel admin access required");

    const updated = plane.updateChannelAuthorized({
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      patch: {
        title: "Lunch relay",
        participants: [
          { id: "avatar:jane", label: "jane", role: "avatar" },
          { id: "user:kzf", label: "kzf", role: "user" },
          { id: "user:gaubee", label: "gaubee", role: "user" },
        ],
      },
    });
    expect(updated.title).toBe("Lunch relay");
    expect(updated.participants.map((participant) => participant.id)).toContain("user:gaubee");

    const grants = plane.listChannelGrantsAuthorized({
      chatId: channel.chatId,
      accessToken: channel.accessToken,
    });
    expect(grants.map((grant) => grant.label)).toEqual(["Relay member", "QA viewer"]);
  });

  test("Scenario: Given an issued channel token When admin revokes it Then later reads and writes are rejected and admin listings stay clean", () => {
    const plane = createPlane();
    const channel = createChannel(plane);
    const readonly = plane.issueChannelGrantAuthorized({
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      role: "readonly",
      label: "Temporary viewer",
    });

    expect(
      plane.listChannelGrantsAuthorized({
        chatId: channel.chatId,
        accessToken: channel.accessToken,
      }),
    ).toHaveLength(1);

    expect(
      plane.revokeChannelGrantAuthorized({
        chatId: channel.chatId,
        accessToken: channel.accessToken,
        grantId: readonly.grantId,
      }),
    ).toEqual({ ok: true });
    expect(
      plane.listChannelGrantsAuthorized({
        chatId: channel.chatId,
        accessToken: channel.accessToken,
      }),
    ).toEqual([]);

    expect(() =>
      plane.snapshotAuthorized({
        chatId: channel.chatId,
        accessToken: readonly.accessToken,
      }),
    ).toThrow("message channel access denied");
  });

  test("Scenario: Given a websocket client When transport tokens are missing or valid Then unauthorized hydration is blocked and authorized snapshots still stream incrementally", async () => {
    const plane = createPlane();
    await plane.startTransport({ port: 0 });
    const channel = createChannel(plane, { chatId: "chat-kzf" });
    const endpoint = plane.getTransportEndpoint(channel.chatId, channel.accessToken);
    if (!endpoint) {
      throw new Error("missing transport endpoint");
    }

    const unauthorizedResponse = await fetch(toHttpUrl(endpoint.url.replace(/\?token=.*$/, "")));
    expect(unauthorizedResponse.status).toBe(401);

    const authorizedSocket = new WebSocket(endpoint.url);
    const snapshotOutcome = await waitForSocketOutcome(authorizedSocket);
    expect(snapshotOutcome.type).toBe("message");
    if (snapshotOutcome.type === "message") {
      expect(snapshotOutcome.payload.type).toBe("snapshot");
      if (snapshotOutcome.payload.type === "snapshot") {
        expect(snapshotOutcome.payload.snapshot.channel.accessToken).toBe(channel.accessToken);
      }
    }

    plane.send({
      chatId: channel.chatId,
      from: "user:kzf",
      content: "ws message",
    });

    const incrementalOutcome = await waitForSocketOutcome(authorizedSocket);
    expect(incrementalOutcome.type).toBe("message");
    if (incrementalOutcome.type === "message") {
      expect(incrementalOutcome.payload.type).toBe("messages");
      if (incrementalOutcome.payload.type === "messages") {
        expect(incrementalOutcome.payload.items[0]?.content).toBe("ws message");
      }
    }

    authorizedSocket.close();
    plane.stopTransport();
  });
});
