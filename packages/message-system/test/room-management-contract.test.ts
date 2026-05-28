import { generatePrincipalKeyPair, type PrincipalId } from "@agenter/principal-crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import {
  MessageControlPlane,
  resolveMessageControlDbPath,
  type MessageAuthorizedReadInput,
  type MessageAuthorizedWriteInput,
  type MessageChannelPatchInput,
  type MessageContactId,
  type MessageControlPlaneEntry,
  type MessageCreateInput,
  type MessageRecord,
  type MessageSnapshot,
  type MessageSystemIdentity,
} from "../src";

type RoomManagementEntry = MessageControlPlaneEntry & {
  systemId: PrincipalId;
  superKey: PrincipalId;
};

type RoomManagementMessageRecord = MessageRecord & {
  sourceSystemId: PrincipalId;
};

type RoomManagementSnapshot = Omit<MessageSnapshot, "channel" | "items"> & {
  channel: RoomManagementEntry;
  items: RoomManagementMessageRecord[];
};

type RoomManagementCreateInput = MessageCreateInput & {
  superKey: PrincipalId;
  systemId?: PrincipalId;
};

type RoomManagementReadInput = {
  chatId: string;
  superKey: PrincipalId;
  limit?: number;
};

type RoomManagementUpdateInput = {
  chatId: string;
  superKey: PrincipalId;
  patch: MessageChannelPatchInput;
};

type RoomManagementArchiveInput = {
  chatId: string;
  superKey: PrincipalId;
  archivedBy: string;
};

type RoomManagementWriteInput = Omit<MessageAuthorizedWriteInput, "accessToken"> & {
  superKey: PrincipalId;
};

type FutureMessageControlPlaneOptions = NonNullable<ConstructorParameters<typeof MessageControlPlane>[0]> & {
  superadminContactId?: PrincipalId;
  systemId?: PrincipalId;
  roomManagementRoot?: string;
};

type RoomManagementContract = MessageControlPlane & {
  getSystemIdentity: () => MessageSystemIdentity;
  createChannel: (input: RoomManagementCreateInput) => RoomManagementEntry;
  sendAuthorized: (input: MessageAuthorizedWriteInput | RoomManagementWriteInput) => RoomManagementMessageRecord;
  snapshotAuthorized: (input: MessageAuthorizedReadInput | RoomManagementReadInput) => RoomManagementSnapshot;
  updateChannelAuthorized: (
    input: Parameters<MessageControlPlane["updateChannelAuthorized"]>[0] | RoomManagementUpdateInput,
  ) => RoomManagementEntry;
  archiveChannelAuthorized: (
    input: Parameters<MessageControlPlane["archiveChannelAuthorized"]>[0] | RoomManagementArchiveInput,
  ) => RoomManagementEntry;
};

const createHarness = () => {
  const root = mkdtempSync(join(tmpdir(), "agenter-room-management-contract-"));
  return {
    root,
    dbPath: resolveMessageControlDbPath(join(root, ".message")),
  };
};

const createPrincipal = (): PrincipalId => generatePrincipalKeyPair().principalId;

const createContractPlane = (input: FutureMessageControlPlaneOptions): RoomManagementContract => {
  const plane = new MessageControlPlane(input);
  const candidate = plane as MessageControlPlane & { getSystemIdentity?: unknown };
  if (typeof candidate.getSystemIdentity !== "function") {
    throw new Error("message-system instance identity contract missing getSystemIdentity()");
  }
  return plane as unknown as RoomManagementContract;
};

const createRoomId = (): PrincipalId => createPrincipal();

const requireContactRoom = (
  plane: MessageControlPlane,
  chatId: string,
  contactId: MessageContactId,
): MessageControlPlaneEntry => {
  const entry = plane.getChannelForContact(chatId, contactId);
  if (!entry) {
    throw new Error(`expected room ${chatId} for Contact ${contactId}`);
  }
  return entry;
};

describe("Feature: room-management and message-system decoupling contract", () => {
  test("Scenario: Given a current superadmin When the default local message-system starts twice Then the stable systemId is the superadmin address", () => {
    const harness = createHarness();
    const superadminContactId = createPrincipal();
    const first = createContractPlane({
      dbPath: harness.dbPath,
      superadminContactId,
    });
    const second = createContractPlane({
      dbPath: harness.dbPath,
      superadminContactId,
    });

    expect(first.getSystemIdentity()).toEqual({
      systemId: superadminContactId,
      superadminContactId,
      defaultLocal: true,
    });
    expect(second.getSystemIdentity().systemId).toBe(superadminContactId);

    first.close();
    second.close();
  });

  test("Scenario: Given one room-management backend When two local message-system instances publish into the same room Then transcript rows persist distinct systemId provenance", () => {
    const harness = createHarness();
    const systemA = createPrincipal();
    const systemB = createPrincipal();
    const planeA = createContractPlane({
      dbPath: harness.dbPath,
      superadminContactId: systemA,
    });
    const planeB = createContractPlane({
      dbPath: harness.dbPath,
      superadminContactId: systemB,
    });

    const room = planeA.createChannel({
      chatId: createRoomId(),
      kind: "room",
      owner: "ops",
      superKey: systemA,
      bootstrapContactId: systemA,
      initialUsers: [
        { contactId: systemA, role: "member", focused: true },
        { contactId: systemB, role: "member", focused: true },
      ],
    });
    const roomForB = requireContactRoom(planeB, room.chatId, systemB);

    const fromA = planeA.sendAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      senderContactId: systemA,
      content: "from system A",
    });
    const fromB = planeB.sendAuthorized({
      chatId: room.chatId,
      accessToken: roomForB.accessToken,
      senderContactId: systemB,
      content: "from system B",
    });
    const snapshot = planeA.snapshotAuthorized({
      chatId: room.chatId,
      superKey: systemA,
      limit: 10,
    });

    expect(fromA.sourceSystemId).toBe(systemA);
    expect(fromB.sourceSystemId).toBe(systemB);
    expect(snapshot.items.map((item) => item.sourceSystemId).sort()).toEqual([systemA, systemB].sort());

    planeA.close();
    planeB.close();
  });

  test("Scenario: Given one message-system serves two Contacts When both Contacts send into a room Then Contact identity stays distinct while systemId stays shared", () => {
    const harness = createHarness();
    const superadminContactId = createPrincipal();
    const contactA = createPrincipal();
    const contactB = createPrincipal();
    const plane = createContractPlane({
      dbPath: harness.dbPath,
      superadminContactId,
    });

    const room = plane.createChannel({
      chatId: createRoomId(),
      kind: "room",
      owner: "ops",
      superKey: superadminContactId,
      bootstrapContactId: contactA,
      initialUsers: [
        { contactId: contactA, role: "member", focused: true },
        { contactId: contactB, role: "member", focused: true },
      ],
    });
    const roomForB = requireContactRoom(plane, room.chatId, contactB);
    const fromA = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      senderContactId: contactA,
      content: "Contact A through the same system",
    });
    const fromB = plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: roomForB.accessToken,
      senderContactId: contactB,
      content: "Contact B through the same system",
    });

    expect(fromA.senderContactId).toBe(contactA);
    expect(fromB.senderContactId).toBe(contactB);
    expect(fromA.sourceSystemId).toBe(superadminContactId);
    expect(fromB.sourceSystemId).toBe(superadminContactId);

    plane.close();
  });

  test("Scenario: Given room superKey without a participant seat When the holder opens room detail Then they can read and manage but cannot send", () => {
    const harness = createHarness();
    const superadminContactId = createPrincipal();
    const plane = createContractPlane({
      dbPath: harness.dbPath,
      superadminContactId,
    });
    const room = plane.createChannel({
      chatId: createRoomId(),
      kind: "room",
      owner: "ops",
      superKey: superadminContactId,
      participants: [],
      initialUsers: [],
    });

    expect(room.superKey).toBe(superadminContactId);
    expect(room.participants.some((participant) => participant.id === superadminContactId)).toBe(false);

    const snapshot = plane.snapshotAuthorized({
      chatId: room.chatId,
      superKey: superadminContactId,
      limit: 10,
    });
    const managed = plane.updateChannelAuthorized({
      chatId: room.chatId,
      superKey: superadminContactId,
      patch: { title: "managed by room superKey" },
    });

    expect(snapshot.channel.participantId).toBeUndefined();
    expect(snapshot.channel.accessRole).toBe("readonly");
    expect(managed.title).toBe("managed by room superKey");
    expect(() =>
      plane.sendAuthorized({
        chatId: room.chatId,
        superKey: superadminContactId,
        senderContactId: superadminContactId,
        content: "superKey is not a sending seat",
      }),
    ).toThrow(/participant|member|send|access/i);

    plane.close();
  });
});
