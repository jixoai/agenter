import { generatePrincipalKeyPair, type PrincipalId } from "@agenter/principal-crypto";
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MessageControlPlane, resolveMessageControlDbPath, type MessageTransportServerMessage } from "../src";

const createPlaneHarness = (): { root: string; dbPath: string; plane: MessageControlPlane } => {
  const root = mkdtempSync(join(tmpdir(), "agenter-message-system-"));
  const dbPath = resolveMessageControlDbPath(join(root, ".message"));
  return {
    root,
    dbPath,
    plane: new MessageControlPlane({ dbPath }),
  };
};

const createPlane = (): MessageControlPlane => createPlaneHarness().plane;

const createRoomId = (): PrincipalId => generatePrincipalKeyPair().principalId;

const createRoom = (
  plane: MessageControlPlane,
  input: {
    chatId?: PrincipalId;
    bootstrapActorId?: `auth:${string}` | `session:${string}` | `system:${string}`;
  } = {},
) =>
  plane.createChannel({
    chatId: input.chatId ?? createRoomId(),
    kind: "room",
    owner: "jane",
    participants: [{ id: "session:jane" }, { id: "auth:kzf" }],
    bootstrapActorId: input.bootstrapActorId ?? "auth:owner",
  });

const waitForSocketOutcome = async (
  socket: WebSocket,
): Promise<
  { type: "message"; payload: MessageTransportServerMessage } | { type: "close"; code: number } | { type: "error" }
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
    const roomId = createRoomId();
    const room = createRoom(plane, { chatId: roomId });

    expect(room.chatId).toBe(roomId);
    expect(room.kind).toBe("room");
    expect(room.accessRole).toBe("admin");
    expect(room.accessToken).toStartWith("msgtok_");
    expect(room.transportUrl).toContain(`/room/${roomId}?token=`);
    expect(() =>
      plane.createChannel({
        chatId: "chat-legacy",
        kind: "room",
        bootstrapActorId: "auth:owner",
      }),
    ).toThrow("invalid room id: chat-legacy");

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

  test("Scenario: Given legacy participant ids When a room is created or updated Then only canonical actor-backed seats remain in durable truth", () => {
    const plane = createPlane();
    const created = plane.createChannel({
      chatId: createRoomId(),
      kind: "room",
      owner: "jane",
      participants: [
        { id: " avatar:default ", label: "Default avatar" },
        { id: " session:relay ", label: " Relay " },
        { id: "user", label: "User" },
      ],
      bootstrapActorId: "auth:owner",
    });

    expect(created.participants).toEqual([{ id: "session:relay", label: "Relay" }]);

    const updated = plane.updateChannelAuthorized({
      chatId: created.chatId,
      accessToken: created.accessToken,
      patch: {
        participants: [
          { id: "auth:owner", label: " Owner " },
          { id: "user", label: "Legacy user" },
          { id: "auth:owner", label: "Owner duplicate" },
        ],
      },
    });

    expect(updated.participants).toEqual([{ id: "auth:owner", label: "Owner" }]);
  });

  test("Scenario: Given legacy session actor aliases When a room is repaired Then grants message authorship and read membership converge on the principal actor", () => {
    const plane = createPlane();
    const principalActorId = generatePrincipalKeyPair().principalId;
    const room = createRoom(plane, { chatId: createRoomId() });

    const legacySeat = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Jane",
      participantId: "session:jane",
    });
    plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      senderActorId: "auth:owner",
      kind: "text",
      content: "hello legacy jane",
    });
    plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: legacySeat.accessToken,
      senderActorId: "session:jane",
      kind: "text",
      content: "legacy jane reply",
    });

    const repaired = plane.repairChannelActorAliases({
      chatId: room.chatId,
      aliases: [{ fromActorId: "session:jane", toActorId: principalActorId }],
    });
    const grants = plane.listChannelGrantsAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    const messages = plane.queryMessagesAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 10,
    }).items;
    const inbound = messages.find((message) => message.content === "hello legacy jane");
    const reply = messages.find((message) => message.content === "legacy jane reply");

    expect(repaired?.participants).toEqual([{ id: principalActorId }, { id: "auth:kzf" }]);
    expect(plane.listChannelsForActor("session:jane")).toHaveLength(0);
    expect(plane.listChannelsForActor(principalActorId)[0]?.chatId).toBe(room.chatId);
    expect(grants.some((grant) => grant.participantId === "session:jane")).toBeFalse();
    expect(grants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId: principalActorId,
          role: "member",
        }),
      ]),
    );
    expect(inbound?.unreadActorIds).toContain(principalActorId);
    expect(inbound?.unreadActorIds).not.toContain("session:jane");
    expect(reply?.senderActorId).toBe(principalActorId);
    expect(reply?.readActorIds).toContain(principalActorId);
    expect(reply?.readActorIds).not.toContain("session:jane");
    expect(plane.getActorUnreadState(principalActorId).unreadTotal).toBe(1);
    expect(plane.getActorUnreadState("session:jane").unreadTotal).toBe(0);
    expect(plane.listUnreadRoomSummaries(principalActorId).map((summary) => summary.chatId)).toContain(room.chatId);
    expect(plane.listUnreadRoomSummaries("session:jane")).toHaveLength(0);
  });

  test("Scenario: Given initial users on room create When the channel is created Then grants and focus materialize immediately without downgrading the bootstrap admin", () => {
    const plane = createPlane();
    const room = plane.createChannel({
      chatId: createRoomId(),
      kind: "room",
      owner: "ops",
      bootstrapActorId: "auth:owner",
      initialUsers: [
        {
          actorId: "auth:owner",
          label: "Owner",
          role: "member",
          focused: true,
        },
        {
          actorId: "auth:viewer",
          label: "Viewer",
          role: "readonly",
          focused: true,
        },
        {
          actorId: "session:jj",
          label: "JJ",
          role: "member",
          focused: false,
        },
      ],
    });

    expect(room.participants).toEqual([
      { id: "auth:owner", label: "Owner" },
      { id: "auth:viewer", label: "Viewer" },
      { id: "session:jj", label: "JJ" },
    ]);
    expect(plane.getChannelForActor(room.chatId, "auth:owner")?.accessRole).toBe("admin");
    expect(plane.listChannelsForActor("auth:viewer")[0]).toMatchObject({
      chatId: room.chatId,
      accessRole: "readonly",
      focused: true,
    });
    expect(plane.listChannelsForActor("session:jj")[0]).toMatchObject({
      chatId: room.chatId,
      accessRole: "member",
      focused: false,
    });

    const grants = plane.listChannelGrantsAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(grants.map((grant) => `${grant.participantId}:${grant.role}`).sort()).toEqual([
      "auth:owner:admin",
      "auth:viewer:readonly",
      "session:jj:member",
    ]);
  });

  test("Scenario: Given long room history When reverse paging runs Then the oldest cursor advances correctly", () => {
    const plane = createPlane();
    const roomId = createRoomId();
    createRoom(plane, { chatId: roomId });
    for (let index = 0; index < 5; index += 1) {
      plane.send({
        chatId: roomId,
        from: `user:${index}`,
        content: `message-${index}`,
        createdAt: 1000 + index,
      });
    }

    const firstPage = plane.queryMessages({ chatId: roomId, limit: 2 });
    expect(firstPage.items.map((item) => item.content)).toEqual(["message-3", "message-4"]);
    expect(firstPage.hasMoreBefore).toBe(true);

    const secondPage = plane.queryMessages({
      chatId: roomId,
      limit: 2,
      before: firstPage.nextBefore,
    });
    expect(secondPage.items.map((item) => item.content)).toEqual(["message-1", "message-2"]);
  });

  test("Scenario: Given readonly member and admin room grants When authorized APIs run Then actor-bound access follows the room matrix", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });

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
    ).toThrow("room grant participantId must be a principal id or auth:/session:/system: actor id");

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
    expect(sent.visibleAt).toBe(sent.createdAt);
    expect(sent.readActorIds).toContain("session:relay");
    expect(sent.unreadActorIds).toEqual(expect.arrayContaining(["auth:owner", "auth:viewer"]));

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
          { id: "session:jane", label: "jane" },
          { id: "auth:kzf", label: "kzf" },
          { id: "session:relay", label: "Relay member" },
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

  test("Scenario: Given same-label room seats When authorized sends persist Then durable senderActorId survives snapshot and paging", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const seatA = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Analyst",
      participantId: "auth:analyst-a",
    });
    const seatB = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Analyst",
      participantId: "session:reviewer",
    });

    const fromA = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: seatA.accessToken,
      content: "message from analyst a",
    });
    const fromB = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: seatB.accessToken,
      content: "message from reviewer",
    });

    expect(fromA.senderActorId).toBe("auth:analyst-a");
    expect(fromB.senderActorId).toBe("session:reviewer");
    expect(fromA.from).toBe("Analyst");
    expect(fromB.from).toBe("Analyst");

    const snapshot = plane.snapshotAuthorized({
      chatId: room.chatId,
      accessToken: seatA.accessToken,
    });
    expect(snapshot.items.find((item) => item.content === "message from analyst a")?.senderActorId).toBe(
      "auth:analyst-a",
    );
    expect(snapshot.items.find((item) => item.content === "message from reviewer")?.senderActorId).toBe(
      "session:reviewer",
    );

    const page = plane.queryMessagesAuthorized({
      chatId: room.chatId,
      accessToken: seatB.accessToken,
      limit: 20,
    });
    expect(page.items.find((item) => item.messageId === fromA.messageId)?.senderActorId).toBe("auth:analyst-a");
    expect(page.items.find((item) => item.messageId === fromB.messageId)?.senderActorId).toBe("session:reviewer");
  });

  test("Scenario: Given a room with grants transcript and read state When it is dissolved Then the room and its dependent facts disappear together", () => {
    const { root, plane } = createPlaneHarness();
    const room = createRoom(plane, { chatId: createRoomId() });
    const relay = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Relay member",
      participantId: "session:relay",
    });

    plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: relay.accessToken,
      from: "session:relay",
      content: "ready",
    });
    plane.markChannelReadAuthorized({
      chatId: room.chatId,
      accessToken: relay.accessToken,
    });
    plane.focusForActor("session:relay", "add", [room.chatId]);

    const deleted = plane.deleteChannelAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });

    expect(deleted.chatId).toBe(room.chatId);
    expect(plane.getChannel(room.chatId, { includeArchived: true })).toBeUndefined();
    expect(plane.getChannelForActor(room.chatId, "session:relay", { includeArchived: true })).toBeUndefined();
    expect(plane.listChannels({ includeArchived: true }).some((entry) => entry.chatId === room.chatId)).toBeFalse();
    expect(
      plane
        .listChannelsForActor("session:relay", { includeArchived: true })
        .some((entry) => entry.chatId === room.chatId),
    ).toBeFalse();
    expect(() =>
      plane.snapshotAuthorized({
        chatId: room.chatId,
        accessToken: relay.accessToken,
      }),
    ).toThrow("message channel access denied");
    const roomDbRoot = join(root, ".message", "rooms");
    if (existsSync(roomDbRoot)) {
      expect(readdirSync(roomDbRoot).some((entry) => entry.includes(room.chatId))).toBeFalse();
    }
  });

  test("Scenario: Given no durable room exists When a raw send targets an unknown chatId Then message-system rejects it without creating an orphan room database", () => {
    const { root, plane } = createPlaneHarness();
    const unknownRoomId = createRoomId();
    const roomDbRoot = join(root, ".message", "rooms");

    expect(() =>
      plane.send({
        chatId: unknownRoomId,
        from: "ghost",
        content: "should not materialize",
      }),
    ).toThrow(`unknown chat channel: ${unknownRoomId}`);
    expect(readdirSync(roomDbRoot).some((entry) => entry.includes(unknownRoomId))).toBeFalse();
  });

  test("Scenario: Given a user joins after historical room traffic When they explicitly read old history Then frozen unread membership stays intact and read membership can still grow", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const historical = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "hello before viewer joins",
    });
    const viewer = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "readonly",
      label: "Viewer",
      participantId: "auth:viewer",
    });

    expect(historical.unreadActorIds).not.toContain("auth:viewer");
    expect(plane.listUnreadRoomSummaries("auth:viewer")).toHaveLength(0);

    const read = plane.markChannelReadAuthorized({
      chatId: room.chatId,
      accessToken: viewer.accessToken,
      messageId: historical.messageId,
    });
    const viewerState = read.seatStates?.find((state) => state.actorId === "auth:viewer");
    const refreshed = plane.getMessage(room.chatId, historical.messageId);

    expect(viewerState).toMatchObject({
      actorId: "auth:viewer",
      role: "readonly",
    });
    expect(Object.prototype.hasOwnProperty.call(read, "readProgress")).toBeFalse();
    expect(refreshed?.readActorIds).toContain("auth:viewer");
    expect(refreshed?.unreadActorIds).not.toContain("auth:viewer");
    expect(plane.listUnreadRoomSummaries("auth:viewer")).toHaveLength(0);
  });

  test("Scenario: Given a sender edits their own durable room message When the edit is authorized Then content changes but delivery membership stays intact", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const sent = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "first draft",
    });

    const edited = plane.editAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      messageId: sent.messageId,
      content: "corrected draft",
      updatedAt: sent.updatedAt + 1,
    });

    expect(edited.messageId).toBe(sent.messageId);
    expect(edited.content).toBe("corrected draft");
    expect(edited.updatedAt).toBe(sent.updatedAt + 1);
    expect(edited.createdAt).toBe(sent.createdAt);
    expect(edited.readActorIds).toEqual(sent.readActorIds);
    expect(edited.unreadActorIds).toEqual(sent.unreadActorIds);
  });

  test("Scenario: Given a room reply points at another durable room message When the send is authorized Then the durable room fact stores same-room ref instead of runtime residue", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const prompt = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "Can you check the duplicate reply?",
    });

    const reply = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      ref: prompt.messageId,
      content: "I am checking it now.",
    });

    const snapshot = plane.snapshotAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
    });
    const persisted = snapshot.items.find((item) => item.messageId === reply.messageId);

    expect(reply.ref).toBe(prompt.messageId);
    expect(persisted?.ref).toBe(prompt.messageId);
    expect(Object.prototype.hasOwnProperty.call(reply, "rootId")).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(persisted ?? {}, "rootId")).toBeFalse();
  });

  test("Scenario: Given a different member tries to edit someone else's durable room message When the edit is authorized Then message-system rejects the mutation", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const member = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Viewer",
      participantId: "auth:viewer",
    });
    const sent = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "owner only",
    });

    expect(() =>
      plane.editAuthorized({
        chatId: room.chatId,
        accessToken: member.accessToken,
        messageId: sent.messageId,
        content: "tampered",
      }),
    ).toThrow("message edit requires original sender");
    expect(plane.getMessage(room.chatId, sent.messageId)?.content).toBe("owner only");
  });

  test("Scenario: Given a sender recalls their own durable room message When the recall is authorized Then the same room fact stays in place with recalled truth", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const sent = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "draft to withdraw",
      attachments: [{ assetId: "asset-1", kind: "file", name: "draft.txt", mimeType: "text/plain", sizeBytes: 12 }],
    });

    const recalled = plane.recallAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      messageId: sent.messageId,
      recalledAt: sent.updatedAt + 2,
    });

    expect(recalled.messageId).toBe(sent.messageId);
    expect(recalled.createdAt).toBe(sent.createdAt);
    expect(recalled.updatedAt).toBe(sent.updatedAt + 2);
    expect(recalled.recalledAt).toBe(sent.updatedAt + 2);
    expect(recalled.recalledByActorId).toBe("auth:owner");
    expect(recalled.content).toBe("");
    expect(recalled.attachments).toEqual([]);
    expect(recalled.readActorIds).toEqual(sent.readActorIds);
    expect(recalled.unreadActorIds).toEqual(sent.unreadActorIds);
  });

  test("Scenario: Given a sender recalls the latest durable room message When resolving active latest visible content Then recalled history is excluded only from the active projection", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const first = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "stable answer",
      createdAt: 100,
    });
    const second = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "draft to withdraw",
      createdAt: 200,
    });

    plane.recallAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      messageId: second.messageId,
      recalledAt: 250,
    });

    expect(plane.queryMessages({ chatId: room.chatId, limit: 5 }).items.map((message) => message.messageId)).toEqual([
      first.messageId,
      second.messageId,
    ]);
    expect(plane.resolveLatestVisibleMessage(room.chatId)?.messageId).toBe(second.messageId);
    expect(plane.resolveLatestVisibleMessage(room.chatId, { includeRecalled: false })?.messageId).toBe(first.messageId);
    expect(plane.resolveLatestActiveVisibleMessage(room.chatId)?.messageId).toBe(first.messageId);
    expect(plane.queryActiveVisibleMessages({ chatId: room.chatId, limit: 5 }).items).toEqual([
      expect.objectContaining({ messageId: first.messageId }),
    ]);
  });

  test("Scenario: Given a different member tries to recall someone else's durable room message When the recall is authorized Then message-system rejects the mutation", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const member = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Viewer",
      participantId: "auth:viewer",
    });
    const sent = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "owner only",
    });

    expect(() =>
      plane.recallAuthorized({
        chatId: room.chatId,
        accessToken: member.accessToken,
        messageId: sent.messageId,
      }),
    ).toThrow("message recall requires original sender");
    expect(plane.getMessage(room.chatId, sent.messageId)?.content).toBe("owner only");
    expect(plane.getMessage(room.chatId, sent.messageId)?.recalledAt).toBeUndefined();
  });

  test("Scenario: Given a recalled durable room message When the sender tries to edit it again Then message-system rejects the edit", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const sent = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "temporary",
    });

    plane.recallAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      messageId: sent.messageId,
    });

    expect(() =>
      plane.editAuthorized({
        chatId: room.chatId,
        accessToken: ownerRoom?.accessToken ?? "",
        messageId: sent.messageId,
        content: "too late",
      }),
    ).toThrow("cannot edit recalled message");
  });

  test("Scenario: Given a runtime waits on actor unread state When unread room work arrives or settles Then unread summaries and wait handles resolve without polling room rows", async () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const viewer = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Viewer",
      participantId: "auth:viewer",
    });

    const initialUnreadVersion = plane.getUnreadVersion("auth:viewer");
    const unreadHandle = plane.waitUnreadCommitted({
      actorId: "auth:viewer",
      fromVersion: initialUnreadVersion,
    });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const sent = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "viewer now has unread work",
    });

    await expect(unreadHandle.promise).resolves.toMatchObject({
      actorId: "auth:viewer",
      version: plane.getUnreadVersion("auth:viewer"),
    });
    expect(plane.getActorUnreadState("auth:viewer").unreadTotal).toBe(1);
    expect(plane.listUnreadRoomSummaries("auth:viewer")).toEqual([
      expect.objectContaining({
        actorId: "auth:viewer",
        chatId: room.chatId,
        unreadCount: 1,
        latestUnreadRowId: sent.rowId,
      }),
    ]);

    const settledVersion = plane.getUnreadVersion("auth:viewer");
    const settledHandle = plane.waitUnreadCommitted({
      actorId: "auth:viewer",
      fromVersion: settledVersion,
    });
    plane.markChannelReadAuthorized({
      chatId: room.chatId,
      accessToken: viewer.accessToken,
      messageId: sent.messageId,
    });

    await expect(settledHandle.promise).resolves.toMatchObject({
      actorId: "auth:viewer",
      version: plane.getUnreadVersion("auth:viewer"),
    });
    expect(plane.getActorUnreadState("auth:viewer").unreadTotal).toBe(0);
    expect(plane.listUnreadRoomSummaries("auth:viewer")).toHaveLength(0);
  });

  test("Scenario: Given an actor still has an older unread message When that actor sends a newer room message Then the room read floor does not jump across the unread hole", () => {
    interface MessagePlaneDbProbe {
      db: {
        getActorRoomState: (
          chatId: string,
          actorId: `auth:${string}` | `session:${string}` | `system:${string}` | `0x${string}`,
        ) =>
          | {
              unreadCount: number;
              lastReadRowId?: number;
              latestUnreadRowId?: number;
            }
          | undefined;
      };
    }

    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
    const viewer = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Viewer",
      participantId: "auth:viewer",
    });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const unread = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "viewer still owes a read",
    });
    const outbound = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: viewer.accessToken,
      senderActorId: "auth:viewer",
      from: "viewer",
      content: "viewer sends before reading",
    });

    const beforeReadState = (plane as unknown as MessagePlaneDbProbe).db.getActorRoomState(room.chatId, "auth:viewer");
    expect(beforeReadState).toMatchObject({
      unreadCount: 1,
      latestUnreadRowId: unread.rowId,
    });
    expect(beforeReadState?.lastReadRowId).toBeUndefined();

    plane.markChannelReadAuthorized({
      chatId: room.chatId,
      accessToken: viewer.accessToken,
      messageId: unread.messageId,
    });

    const afterReadState = (plane as unknown as MessagePlaneDbProbe).db.getActorRoomState(room.chatId, "auth:viewer");
    expect(afterReadState).toMatchObject({
      unreadCount: 0,
      lastReadRowId: outbound.rowId,
      latestUnreadRowId: undefined,
    });
  });

  test("Scenario: Given an ordered admin-group When presence changes Then one current admin owns pending room work and higher priority candidates can preempt", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
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

  test("Scenario: Given multiple room seats When different actors mark the latest visible message Then durable message arrays and seat metadata stay actor-scoped", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
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
    expect(Object.prototype.hasOwnProperty.call(initial.channel, "readProgress")).toBeFalse();
    expect(initial.channel.seatStates?.map((state) => state.actorId).sort()).toEqual([
      "auth:owner",
      "auth:viewer",
      "session:relay",
    ]);

    const relayRead = plane.markChannelReadAuthorized({
      chatId: room.chatId,
      accessToken: relay.accessToken,
      messageId: visible.messageId,
    });
    const relayState = relayRead.seatStates?.find((state) => state.actorId === "session:relay");
    const relayMessage = plane.getMessage(room.chatId, visible.messageId);
    expect(relayState).toMatchObject({
      actorId: "session:relay",
      focused: true,
      online: true,
    });
    expect(relayMessage?.readActorIds).toContain("session:relay");
    expect(relayMessage?.unreadActorIds).not.toContain("session:relay");
    expect(Object.prototype.hasOwnProperty.call(relayRead, "readProgress")).toBeFalse();

    const ownerRead = plane.markChannelReadAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    const ownerState = ownerRead.seatStates?.find((state) => state.actorId === "auth:owner");
    const viewerState = ownerRead.seatStates?.find((state) => state.actorId === "auth:viewer");
    const ownerMessage = plane.getMessage(room.chatId, visible.messageId);
    expect(ownerState).toMatchObject({
      actorId: "auth:owner",
      online: true,
    });
    expect(viewerState).toMatchObject({
      actorId: "auth:viewer",
      online: true,
    });
    expect(ownerMessage?.readActorIds.sort()).toEqual(["auth:owner", "session:relay"]);
    expect(ownerMessage?.unreadActorIds).toEqual(["auth:viewer"]);
    expect(Object.prototype.hasOwnProperty.call(ownerRead, "readProgress")).toBeFalse();
    expect(
      Object.prototype.hasOwnProperty.call(
        plane.snapshotAuthorized({ chatId: room.chatId, accessToken: viewer.accessToken }).channel,
        "readProgress",
      ),
    ).toBeFalse();
  });

  test("Scenario: Given an unread seat with invalid credentials When room collaboration state is projected Then that seat stays visible and flagged instead of disappearing", () => {
    const plane = createPlane();
    const room = createRoom(plane, { chatId: createRoomId() });
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
    });

    const projected = plane.snapshotAuthorized({
      chatId: room.chatId,
      accessToken: viewer.accessToken,
    }).channel;
    expect(Object.prototype.hasOwnProperty.call(projected, "readProgress")).toBeFalse();
    expect(projected.seatStates?.find((state) => state.actorId === "auth:viewer")).toMatchObject({
      actorId: "auth:viewer",
      invalidCredential: true,
    });
  });

  test("Scenario: Given a revoked room credential When authorized APIs reject that seat and a valid transport still boots Then superadmin can still recover the room", async () => {
    const plane = createPlane();
    await plane.startTransport({ port: 0 });
    const room = createRoom(plane, { chatId: createRoomId() });
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

  test("Scenario: Given schema-2 legacy room durability When the control plane reopens Then the breaking reset clears legacy room rows", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-message-system-legacy-reset-"));
    const dbPath = resolveMessageControlDbPath(join(root, ".message"));
    mkdirSync(join(root, ".message"), { recursive: true });
    const db = new Database(dbPath, { create: true, strict: true });
    const now = Date.now();
    db.exec(`
      create table chat_channel (
        chat_id text primary key,
        kind text not null,
        title text not null,
        owner text not null,
        context_id text,
        participants_json text not null,
        metadata_json text,
        created_at integer not null,
        updated_at integer not null,
        archived_at integer,
        archived_by text
      ) strict;
      pragma user_version = 2;
    `);
    db.query(
      `insert into chat_channel (
          chat_id, kind, title, owner, context_id, participants_json, metadata_json, created_at, updated_at, archived_at, archived_by
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, null, null)`,
    ).run("room-legacy", "room", "Legacy", "jane", null, "[]", "{}", now, now);
    db.close();

    const plane = new MessageControlPlane({ dbPath });
    expect(plane.listChannels()).toHaveLength(0);
    plane.close();
  });

  test("Scenario: Given a crashed control-plane delete leaves an orphan room database When the control plane reopens Then startup prunes the orphan room files", () => {
    const { root, dbPath, plane } = createPlaneHarness();
    const room = createRoom(plane, { chatId: createRoomId() });
    plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      senderActorId: "auth:owner",
      content: "orphan me",
    });
    plane.close();

    const controlDb = new Database(dbPath, { create: true, strict: true });
    controlDb.exec(`pragma foreign_keys = on;`);
    controlDb.query(`delete from chat_channel where chat_id = ?`).run(room.chatId);
    controlDb.close();

    const roomDbRoot = join(root, ".message", "rooms");
    expect(readdirSync(roomDbRoot).some((entry) => entry.includes(room.chatId))).toBeTrue();

    const reopened = new MessageControlPlane({ dbPath });
    try {
      expect(reopened.listChannels()).toEqual([]);
      expect(readdirSync(roomDbRoot).some((entry) => entry.includes(room.chatId))).toBeFalse();
    } finally {
      reopened.close();
    }
  });

  test("Scenario: Given a persisted actor-room unread hole When the control plane reopens Then startup repair recomputes the durable room floor from message truth", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-message-system-repair-"));
    const dbPath = resolveMessageControlDbPath(join(root, ".message"));
    const plane = new MessageControlPlane({ dbPath });
    const room = createRoom(plane, { chatId: createRoomId() });
    const viewer = plane.issueChannelGrantAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      label: "Viewer",
      participantId: "auth:viewer",
    });
    const ownerRoom = plane.getChannelForActor(room.chatId, "auth:owner", {
      includeArchived: true,
      touchPresence: false,
    });
    const unread = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: ownerRoom?.accessToken ?? "",
      senderActorId: "auth:owner",
      from: "owner",
      content: "viewer owes a read",
    });
    const outbound = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: viewer.accessToken,
      senderActorId: "auth:viewer",
      from: "viewer",
      content: "viewer self-read outbound",
    });
    plane.close();

    const corrupted = new Database(dbPath, { create: true, strict: true });
    corrupted
      .query(
        `update actor_room_state
         set unread_count = 1,
             last_read_row_id = ?,
             last_read_at = ?,
             latest_unread_row_id = null,
             latest_unread_at = null
         where chat_id = ? and actor_id = ?`,
      )
      .run(outbound.rowId, outbound.visibleAt ?? outbound.createdAt, room.chatId, "auth:viewer");
    corrupted.close();

    const repaired = new MessageControlPlane({ dbPath });
    expect(repaired.listUnreadRoomSummaries("auth:viewer")).toEqual([
      expect.objectContaining({
        actorId: "auth:viewer",
        chatId: room.chatId,
        unreadCount: 1,
        latestUnreadRowId: unread.rowId,
      }),
    ]);
    repaired.close();

    const verified = new Database(dbPath, { create: true, strict: true });
    const repairedRow = verified
      .query(
        `select unread_count, last_read_row_id, latest_unread_row_id
         from actor_room_state
         where chat_id = ? and actor_id = ?`,
      )
      .get(room.chatId, "auth:viewer") as {
      unread_count: number;
      last_read_row_id: number | null;
      latest_unread_row_id: number | null;
    } | null;
    verified.close();

    expect(repairedRow).toEqual({
      unread_count: 1,
      last_read_row_id: null,
      latest_unread_row_id: unread.rowId,
    });
  });
});
