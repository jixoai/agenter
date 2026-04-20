import { generatePrincipalKeyPair, type PrincipalId } from "@agenter/principal-crypto";
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MessageControlPlane,
  resolveMessageControlDbPath,
  resolveMessageQueryDbPath,
  type MessageAttachment,
} from "../src";

const createPlaneHarness = (): { root: string; dbPath: string; plane: MessageControlPlane } => {
  const root = mkdtempSync(join(tmpdir(), "agenter-message-query-"));
  const dbPath = resolveMessageControlDbPath(join(root, ".message"));
  return {
    root,
    dbPath,
    plane: new MessageControlPlane({ dbPath }),
  };
};

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
    owner: "ops",
    participants: [{ id: "auth:viewer" }, { id: "auth:owner" }],
    bootstrapActorId: input.bootstrapActorId ?? "auth:owner",
  });

const logAttachment: MessageAttachment = {
  assetId: "asset-log",
  kind: "file",
  name: "incident.txt",
  mimeType: "text/plain",
  sizeBytes: 12,
  url: "file:///incident.txt",
};

describe("Feature: message query", () => {
  test("Scenario: Given durable room history When the sidecar query index is missing Then message query rebuilds from room truth", () => {
    const { root, dbPath, plane } = createPlaneHarness();
    const room = createRoom(plane);
    plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      senderActorId: "auth:owner",
      kind: "text",
      content: "deploy failed in production",
    });
    plane.close();

    const queryDbPath = resolveMessageQueryDbPath(join(root, ".message"));
    rmSync(queryDbPath, { force: true });
    rmSync(`${queryDbPath}-wal`, { force: true });
    rmSync(`${queryDbPath}-shm`, { force: true });

    const reopened = new MessageControlPlane({ dbPath });
    const result = reopened.queryAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      mode: "match",
      query: "deploy failed",
    });

    expect(result.resultKind).toBe("messages");
    if (result.resultKind !== "messages") {
      throw new Error("expected message result");
    }
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.message.content).toBe("deploy failed in production");
    reopened.close();
  });

  test("Scenario: Given actor-scoped room grants When cross-room query runs Then only authorized rooms are searchable", () => {
    const { plane } = createPlaneHarness();
    const authorizedRoom = createRoom(plane, { chatId: createRoomId() });
    const forbiddenRoom = createRoom(plane, { chatId: createRoomId() });

    plane.issueChannelGrantAuthorized({
      chatId: authorizedRoom.chatId,
      accessToken: authorizedRoom.accessToken,
      role: "readonly",
      participantId: "auth:viewer",
      label: "Viewer",
    });

    plane.sendAuthorized({
      chatId: authorizedRoom.chatId,
      accessToken: authorizedRoom.accessToken,
      senderActorId: "auth:owner",
      kind: "text",
      content: "incident report alpha",
    });
    plane.sendAuthorized({
      chatId: forbiddenRoom.chatId,
      accessToken: forbiddenRoom.accessToken,
      senderActorId: "auth:owner",
      kind: "text",
      content: "incident report beta",
    });

    const allowed = plane.queryAuthorized({
      chatId: "*",
      actorId: "auth:viewer",
      mode: "match",
      query: "incident report",
    });

    expect(allowed.resultKind).toBe("messages");
    if (allowed.resultKind !== "messages") {
      throw new Error("expected message result");
    }
    expect(allowed.chatIds).toEqual([authorizedRoom.chatId]);
    expect(allowed.items.map((item) => item.chatId)).toEqual([authorizedRoom.chatId]);
    expect(() =>
      plane.queryAuthorized({
        chatId: [authorizedRoom.chatId, forbiddenRoom.chatId],
        actorId: "auth:viewer",
        mode: "match",
        query: "incident",
      }),
    ).toThrow("message room credential-invalid");
  });

  test("Scenario: Given query and sql modes When message query executes Then structured filters work and mutating sql is rejected", () => {
    const { plane } = createPlaneHarness();
    const room = createRoom(plane);

    plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      senderActorId: "auth:owner",
      kind: "text",
      content: "incident report attached",
      attachments: [logAttachment],
    });
    plane.sendAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      senderActorId: "auth:owner",
      kind: "text",
      content: "plain follow up",
    });

    const structured = plane.queryAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      mode: "query",
      query: 'from:auth:owner has:attachment "incident report"',
    });

    expect(structured.resultKind).toBe("messages");
    if (structured.resultKind !== "messages") {
      throw new Error("expected message result");
    }
    expect(structured.items).toHaveLength(1);
    expect(structured.items[0]?.message.attachments).toHaveLength(1);

    const sql = plane.queryAuthorized({
      chatId: room.chatId,
      accessToken: room.accessToken,
      mode: "sql",
      query: "select kind, count(*) as message_count from messages group by kind order by kind asc",
    });

    expect(sql.resultKind).toBe("sql");
    if (sql.resultKind !== "sql") {
      throw new Error("expected sql result");
    }
    expect(sql.columns).toEqual(["kind", "message_count"]);
    expect(sql.rows).toEqual([{ kind: "text", message_count: 2 }]);
    expect(() =>
      plane.queryAuthorized({
        chatId: room.chatId,
        accessToken: room.accessToken,
        mode: "sql",
        query: "delete from messages",
      }),
    ).toThrow("message query sql must start with SELECT or WITH");
    expect(() =>
      plane.queryAuthorized({
        chatId: room.chatId,
        accessToken: room.accessToken,
        mode: "sql",
        query: "attach 'other.db' as other; select * from messages",
      }),
    ).toThrow("message query sql must contain exactly one statement");
  });
});
