import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MessageControlPlane, type MessageTransportServerMessage } from "../src";

const createPlane = (): MessageControlPlane => {
  const root = mkdtempSync(join(tmpdir(), "agenter-message-system-"));
  return new MessageControlPlane({ dbPath: join(root, ".message", "message.db") });
};

const createRoom = (
  plane: MessageControlPlane,
  input: {
    chatId?: string;
    bootstrapActorId?: `auth:${string}` | `session:${string}` | `system:${string}`;
  } = {},
) =>
  plane.createChannel({
    chatId: input.chatId ?? "room-kzf",
    kind: "room",
    owner: "jane",
    participants: [{ id: "avatar:jane" }, { id: "user:kzf" }],
    bootstrapActorId: input.bootstrapActorId ?? "auth:owner",
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
  test("Scenario: Given room-only durability When rooms are created and listed for actors Then only room ids survive and same labels still get separate seats", async () => {
    const plane = createPlane();
    await plane.startTransport({ port: 0 });
    const room = createRoom(plane, { chatId: "room-team" });

    expect(room.chatId).toBe("room-team");
    expect(room.kind).toBe("room");
    expect(room.accessRole).toBe("admin");
    expect(room.accessToken).toStartWith("msgtok_");
    expect(room.transportUrl).toContain("/room/room-team?token=");
    expect(() =>
      plane.createChannel({
        chatId: "chat-legacy",
        kind: "room",
        bootstrapActorId: "auth:owner",
      }),
    ).toThrow("invalid room id prefix: chat-legacy");

    const seatA = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "same-avatar",
      participantId: "session:avatar-a",
    });
    const seatB = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "same-avatar",
      participantId: "session:avatar-b",
    });

    expect(seatA.accessToken).not.toBe(seatB.accessToken);
    expect(plane.listChannelsForActor("session:avatar-a")[0]?.accessToken).toBe(seatA.accessToken);
    expect(plane.listChannelsForActor("session:avatar-b")[0]?.accessToken).toBe(seatB.accessToken);
    expect(plane.listChannels()[0]?.chatId).toBe(room.chatId);
    expect(plane.listChannels()[0]?.accessRole).toBe("admin");
    expect(plane.listChannels()[0]?.accessToken).toStartWith("msgtok_");
    plane.stopTransport();
  });

  test("Scenario: Given long room history When reverse paging runs Then the oldest cursor advances correctly", () => {
    const plane = createPlane();
    createRoom(plane, { chatId: "room-history" });
    for (let index = 0; index < 5; index += 1) {
      plane.send({
        chatId: "room-history",
        from: `user:${index}`,
        content: `message-${index}`,
        createdAt: 1000 + index,
      });
    }

    const firstPage = plane.queryMessages({ chatId: "room-history", limit: 2 });
    expect(firstPage.items.map((item) => item.content)).toEqual(["message-3", "message-4"]);
    expect(firstPage.hasMoreBefore).toBe(true);

    const secondPage = plane.queryMessages({
      chatId: "room-history",
      limit: 2,
      before: firstPage.nextBefore,
    });
    expect(secondPage.items.map((item) => item.content)).toEqual(["message-1", "message-2"]);
  });

  test("Scenario: Given readonly member and admin room grants When authorized APIs run Then actor-bound access follows the room matrix", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: "room-lunch" });

    const readonly = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "readonly",
      label: "QA viewer",
      participantId: "auth:viewer",
    });
    const member = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Relay member",
      participantId: "session:relay",
    });

    expect(() =>
      plane.issueChannelGrantAuthorized({
        chatId: room.chatId,
        accessToken: room.accessToken,
        role: "member",
        label: "bad",
        participantId: "user:legacy-seat",
      }),
    ).toThrow("room grant participantId must be an auth:/session:/system: actor id");

    const readonlySnapshot = plane.snapshotAuthorized({
      chatId: room.chatId,
      accessToken: readonly.accessToken,
    });
    expect(readonlySnapshot.channel.accessRole).toBe("readonly");
    expect(readonlySnapshot.channel.accessToken).toBe(readonly.accessToken);
    expect(plane.getChannelForActor(room.chatId, "auth:viewer")?.accessToken).toBe(readonly.accessToken);
    expect(plane.getChannelForActor(room.chatId, "session:relay")?.accessToken).toBe(member.accessToken);
    expect(() =>
      plane.sendAuthorized({
        chatId: room.chatId,
        accessToken: readonly.accessToken,
        from: "user:kzf",
        content: "blocked",
      }),
    ).toThrow("message channel member access required");

    const sent = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: member.accessToken,
      from: "user:kzf",
      content: "member message",
    });
    expect(sent.content).toBe("member message");
    expect(sent.attentionState).toBe("queued");
    expect(sent.visibleAt).toBe(sent.createdAt);
    expect(sent.editable).toBe(true);

    const interactive = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: member.accessToken,
      from: "user:kzf",
      kind: "interactive",
      content: "Please fill this form",
      payload: {
        interactive: {
          version: "v1",
          kind: "form",
          title: "Lunch poll",
          fields: [{ id: "choice", label: "What to eat?" }],
        },
      },
    });
    expect(interactive.kind).toBe("interactive");
    expect(interactive.payload?.interactive?.title).toBe("Lunch poll");

    expect(() =>
      plane.sendAuthorized({
        chatId: room.chatId,
        accessToken: member.accessToken,
        from: "system",
        kind: "error",
        content: "forbidden",
        payload: {
          error: {
            title: "forbidden",
          },
        },
      }),
    ).toThrow("message channel admin access required");

    const adminError = plane.sendErrorAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      from: "system",
      kind: "error",
      content: "runtime unavailable",
      payload: {
        error: {
          title: "Runtime error",
          code: "E_RUNTIME",
          detail: "provider timeout",
        },
      },
    });
    expect(adminError.kind).toBe("error");
    expect(adminError.payload?.error?.code).toBe("E_RUNTIME");
    expect(adminError.attentionState).toBe("loaded");
    expect(adminError.visibleAt).toBeDefined();

    expect(() =>
      plane.updateChannelAuthorized({
        chatId: room.chatId,
        accessToken: member.accessToken,
        patch: { title: "Nope" },
      }),
    ).toThrow("message channel admin access required");

    const updated = plane.updateChannelAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      patch: {
        title: "Lunch relay",
        participants: [
          { id: "avatar:jane", label: "jane", role: "avatar" },
          { id: "user:kzf", label: "kzf", role: "user" },
          { id: "session:relay", label: "Relay member", role: "avatar" },
        ],
        metadata: { topic: "lunch" },
      },
    });
    expect(updated.title).toBe("Lunch relay");
    expect(updated.metadata?.topic).toBe("lunch");
    expect(updated.participants.map((participant) => participant.id)).toContain("session:relay");

    const recent = plane.queryMessages({ chatId: room.chatId, limit: 4 }).items;
    expect(recent.map((item) => item.kind)).toEqual(["text", "interactive", "error"]);

    const grants = plane.listChannelGrantsAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(grants.map((grant) => grant.participantId).sort()).toEqual(["auth:owner", "auth:viewer", "session:relay"]);
  });

  test("Scenario: Given a queued room message When it is edited before attention reads it Then the same messageId stays visible in transcript order until it is marked loaded", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: "room-pending" });
    const member = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "User",
      participantId: "session:user-seat",
    });

    const queued = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: member.accessToken,
      from: "user:kzf",
      content: "first draft",
    });
    expect(queued.attentionState).toBe("queued");
    expect(queued.visibleAt).toBe(queued.createdAt);
    expect(queued.editable).toBe(true);

    const edited = plane.editAuthorized({
      chatId: room.chatId,
      accessToken: member.accessToken,
      messageId: queued.messageId,
      content: "edited draft",
    });
    expect(edited.messageId).toBe(queued.messageId);
    expect(edited.content).toBe("edited draft");
    expect(edited.attentionState).toBe("queued");
    expect(edited.visibleAt).toBe(queued.createdAt);

    const loaded = plane.markMessageAttentionLoaded({
      chatId: room.chatId,
      messageId: queued.messageId,
      loadedAt: 1234,
    });
    expect(loaded.messageId).toBe(queued.messageId);
    expect(loaded.attentionState).toBe("loaded");
    expect(loaded.visibleAt).toBe(queued.createdAt);
    expect(loaded.attentionLoadedAt).toBe(1234);
    expect(loaded.editable).toBe(false);

    expect(() =>
      plane.editAuthorized({
        chatId: room.chatId,
        accessToken: member.accessToken,
        messageId: queued.messageId,
        content: "too late",
      }),
    ).toThrow("queued message can no longer be edited");
  });

  test("Scenario: Given an ordered admin-group When presence changes Then one current admin owns pending room work and higher priority candidates can preempt", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: "room-admins" });
    const alice = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "admin",
      label: "Alice",
      participantId: "auth:alice",
    });
    const bob = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "admin",
      label: "Bob",
      participantId: "auth:bob",
    });

    plane.updateChannelAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      patch: {
        adminGroupCandidateIds: ["auth:alice", "auth:bob"],
        metadata: { topic: "ops" },
      },
    });
    plane.setActorPresence("auth:bob", true);
    plane.setActorPresence("auth:alice", true);

    expect(plane.getChannelForActor(room.chatId, "auth:alice")?.metadata?.currentRoomAdminId).toBe("auth:alice");
    expect(() =>
      plane.updateChannelAuthorized({
        chatId: room.chatId,
        accessToken: bob.accessToken,
        patch: { title: "Bob cannot preempt yet" },
      }),
    ).toThrow("message room current-admin required");

    const pending = plane.queueAdminWork({
      chatId: room.chatId,
      requestedBy: "session:observer",
      kind: "metadata_update",
      payload: { field: "topic" },
    });
    expect(pending.assignedAdminId).toBe("auth:alice");
    expect(plane.listPendingAdminWork(room.chatId)[0]?.assignedAdminId).toBe("auth:alice");

    plane.setActorPresence("auth:alice", false);
    expect(plane.getChannelForActor(room.chatId, "auth:bob")?.metadata?.currentRoomAdminId).toBe("auth:bob");
    expect(plane.listPendingAdminWork(room.chatId)[0]?.assignedAdminId).toBe("auth:bob");

    const bobUpdate = plane.updateChannelAuthorized({
      chatId: room.chatId,
      accessToken: bob.accessToken,
      patch: { title: "Bob on duty" },
    });
    expect(bobUpdate.title).toBe("Bob on duty");
    expect(bobUpdate.metadata?.topic).toBe("ops");

    plane.setActorPresence("auth:alice", true);
    expect(plane.getChannelForActor(room.chatId, "auth:alice")?.metadata?.currentRoomAdminId).toBe("auth:alice");
    expect(plane.listPendingAdminWork(room.chatId)[0]?.assignedAdminId).toBe("auth:alice");
  });

  test("Scenario: Given multiple room seats When different actors mark the latest visible message Then aggregate read progress and per-seat timestamps stay actor-scoped", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: "room-read-progress" });
    const viewer = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "readonly",
      label: "Viewer",
      participantId: "auth:viewer",
    });
    const relay = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Relay",
      participantId: "session:relay",
    });
    const visible = plane.send({
      chatId: room.chatId,
      from: "system",
      content: "visible room update",
      createdAt: 1_000,
      updatedAt: 1_000,
      visibleAt: 1_000,
    });

    plane.setActorPresence("auth:owner", true);
    plane.setActorPresence("auth:viewer", true);
    plane.setActorPresence("session:relay", true);
    plane.focusForActor("session:relay", "replace", [room.chatId]);

    const initial = plane.snapshotAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(initial.channel.readProgress).toMatchObject({
      latestVisibleMessageId: visible.messageId,
      totalSeatCount: 3,
      readSeatCount: 0,
      unreadSeatCount: 3,
    });

    const relayRead = plane.markChannelReadAuthorized({
      chatId: room.chatId,
      accessToken: relay.accessToken,
      messageId: visible.messageId,
      readAt: 2_000,
    });
    expect(relayRead.readProgress).toMatchObject({
      latestVisibleMessageId: visible.messageId,
      totalSeatCount: 3,
      readSeatCount: 1,
      unreadSeatCount: 2,
    });
    const relayState = relayRead.readStates?.find((state) => state.actorId === "session:relay");
    expect(relayState).toMatchObject({
      actorId: "session:relay",
      hasReadLatestVisible: true,
      readAt: 2_000,
      focused: true,
      online: true,
    });

    const ownerRead = plane.markChannelReadAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      readAt: 3_000,
    });
    expect(ownerRead.readProgress).toMatchObject({
      latestVisibleMessageId: visible.messageId,
      totalSeatCount: 3,
      readSeatCount: 2,
      unreadSeatCount: 1,
    });
    const ownerState = ownerRead.readStates?.find((state) => state.actorId === "auth:owner");
    const viewerState = ownerRead.readStates?.find((state) => state.actorId === "auth:viewer");
    expect(ownerState).toMatchObject({
      actorId: "auth:owner",
      hasReadLatestVisible: true,
      readAt: 3_000,
      online: true,
    });
    expect(viewerState).toMatchObject({
      actorId: "auth:viewer",
      hasReadLatestVisible: false,
      readAt: undefined,
      online: true,
    });
    expect(plane.snapshotAuthorized({ chatId: room.chatId, accessToken: viewer.accessToken }).channel.readProgress).toMatchObject({
      latestVisibleMessageId: visible.messageId,
      readSeatCount: 2,
      unreadSeatCount: 1,
    });
  });

  test("Scenario: Given an unread seat with invalid credentials When room collaboration state is projected Then that seat stays visible and flagged instead of disappearing", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: "room-read-invalid" });
    const viewer = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "readonly",
      label: "Viewer",
      participantId: "auth:viewer",
    });
    const relay = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Relay",
      participantId: "session:relay",
    });
    const visible = plane.send({
      chatId: room.chatId,
      from: "system",
      content: "durable visibility",
      createdAt: 4_000,
      updatedAt: 4_000,
      visibleAt: 4_000,
    });

    plane.setCredentialState("auth:viewer", { invalidCredential: true });
    plane.markChannelReadAuthorized({
      chatId: room.chatId,
      accessToken: relay.accessToken,
      messageId: visible.messageId,
      readAt: 5_000,
    });

    const projected = plane.snapshotAuthorized({
      chatId: room.chatId,
      accessToken: viewer.accessToken,
    }).channel;
    expect(projected.readProgress).toMatchObject({
      latestVisibleMessageId: visible.messageId,
      totalSeatCount: 3,
      readSeatCount: 1,
      unreadSeatCount: 2,
      invalidCredentialSeatCount: 1,
    });
    expect(projected.readStates?.find((state) => state.actorId === "auth:viewer")).toMatchObject({
      actorId: "auth:viewer",
      hasReadLatestVisible: false,
      invalidCredential: true,
    });
  });

  test("Scenario: Given revoked or malformed room credentials When room APIs or transport validate them Then callers receive explicit credential-invalid and superadmin can still recover the room", async () => {
    const plane = createPlane();
    await plane.startTransport({ port: 0 });
    const room = createRoom(plane, { chatId: "room-transport" });
    const readonly = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "readonly",
      label: "Temporary viewer",
      participantId: "auth:viewer",
    });
    const endpoint = plane.getTransportEndpoint(room.chatId, room.accessToken);
    if (!endpoint) {
      throw new Error("missing transport endpoint");
    }

    expect(
      plane.revokeChannelGrantAuthorized({
        chatId: room.chatId,
        accessToken: room.accessToken,
        grantId: readonly.grantId,
      }),
    ).toEqual({ ok: true });
    expect(() =>
      plane.snapshotAuthorized({
        chatId: room.chatId,
        accessToken: readonly.accessToken,
      }),
    ).toThrow("message room credential-invalid");

    const missingTokenResponse = await fetch(toHttpUrl(endpoint.url.replace(/\?token=.*$/, "")));
    expect(missingTokenResponse.status).toBe(401);

    const invalidTokenUrl = new URL(toHttpUrl(endpoint.url));
    invalidTokenUrl.searchParams.set("token", "msgtok_invalidcredential0001");
    const invalidTokenResponse = await fetch(invalidTokenUrl);
    expect(invalidTokenResponse.status).toBe(401);
    expect(await invalidTokenResponse.text()).toBe("credential-invalid");

    const authorizedSocket = new WebSocket(endpoint.url);
    const snapshotOutcome = await waitForSocketOutcome(authorizedSocket);
    expect(snapshotOutcome.type).toBe("message");
    if (snapshotOutcome.type === "message") {
      expect(snapshotOutcome.payload.type).toBe("snapshot");
      if (snapshotOutcome.payload.type === "snapshot") {
        expect(snapshotOutcome.payload.snapshot.channel.accessToken).toBe(room.accessToken);
      }
    }

    plane.send({
      chatId: room.chatId,
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

    const rescued = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      superadminActorId: "auth:superadmin",
      role: "member",
      label: "Recovered member",
      participantId: "session:rescued",
      accessToken: "",
    });
    expect(plane.snapshotAuthorized({ chatId: room.chatId, accessToken: rescued.accessToken }).channel.accessRole).toBe(
      "member",
    );

    authorizedSocket.close();
    plane.stopTransport();
  });
});
