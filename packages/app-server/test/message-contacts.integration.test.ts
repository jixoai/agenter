import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appRouter, createTrpcContext } from "../src";
import { startTrpcServer, type TrpcServerHandle } from "../../cli/src/trpc-server";

const tempDirs: string[] = [];
const handles: TrpcServerHandle[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-message-contacts-"));
  tempDirs.push(dir);
  return dir;
};

const stopHandle = async (handle: TrpcServerHandle): Promise<void> => {
  await handle.stop();
};

afterEach(async () => {
  while (handles.length > 0) {
    const handle = handles.pop();
    if (handle) {
      await stopHandle(handle);
    }
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const ROOT_AUTH_PRIVATE_KEY_A = "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1";
const ROOT_AUTH_PRIVATE_KEY_B = "0x8b3a350cf5c34c9194ca3a545d62f7f43f33b6589e1ff8c33c321d89d6ad8e7b";

const startHandle = async (privateKey: string): Promise<TrpcServerHandle> => {
  const root = makeTempDir();
  const handle = await startTrpcServer({
    host: "127.0.0.1",
    port: 0,
    globalSessionRoot: join(root, "sessions"),
    workspacesPath: join(root, "workspaces.yaml"),
    homeDir: join(root, "home"),
    authService: {
      rootAuthPrivateKey: privateKey as `0x${string}`,
    },
  });
  handles.push(handle);
  return handle;
};

const createAuthedCaller = async (handle: TrpcServerHandle) => {
  const anonymousCaller = appRouter.createCaller(await createTrpcContext(handle.kernel));
  const autoLogin = await anonymousCaller.auth.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`expected auto login to succeed: ${autoLogin.message}`);
  }
  const session = autoLogin.session;
  const caller = appRouter.createCaller(
    await createTrpcContext({
      kernel: handle.kernel,
      authorizationHeader: `Bearer ${session.token}`,
    }),
  );
  return { caller, session };
};

const endpointOf = (handle: TrpcServerHandle): string => `http://${handle.host}:${handle.port}`;

describe("Feature: message-system contacts over remote sources", () => {
  test("Scenario: Given two subscribed remote sources When one actor searches and sends a contact request Then the remote inbox and both local contacts can complete without a preexisting shared room", async () => {
    const handleA = await startHandle(ROOT_AUTH_PRIVATE_KEY_A);
    const handleB = await startHandle(ROOT_AUTH_PRIVATE_KEY_B);
    const { caller: callerA, session: sessionA } = await createAuthedCaller(handleA);
    const { caller: callerB, session: sessionB } = await createAuthedCaller(handleB);
    const actorA = `auth:${sessionA.claims.authId}` as const;
    const actorB = `auth:${sessionB.claims.authId}` as const;

    await callerA.message.sourceUpsert({
      sourceId: "source-b",
      label: "B",
      endpoint: endpointOf(handleB),
      authToken: sessionB.token,
      callbackSourceId: "source-a",
      callbackEndpoint: endpointOf(handleA),
    });
    await callerB.message.sourceUpsert({
      sourceId: "source-a",
      label: "A",
      endpoint: endpointOf(handleA),
      authToken: sessionA.token,
      callbackSourceId: "source-b",
      callbackEndpoint: endpointOf(handleB),
    });

    const search = await callerA.message.contactSearch({
      sourceId: "source-b",
      query: sessionB.claims.authId,
    });
    expect(search).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: actorB,
          sourceId: "source-b",
        }),
      ]),
    );

    const sent = await callerA.message.contactRequestSend({
      sourceId: "source-b",
      remoteActorId: actorB,
      message: "please add me",
    });
    const inbox = await callerB.message.contactRequestList({
      direction: "inbound",
    });

    expect(sent.request.direction).toBe("outbound");
    expect(inbox.items).toEqual([
      expect.objectContaining({
        requestId: sent.request.requestId,
        direction: "inbound",
        sourceId: "source-a",
        remoteActorId: actorA,
      }),
    ]);

    const accepted = await callerB.message.acceptContactRequest({
      requestId: sent.request.requestId,
    });
    expect(accepted.result.contact.remoteActorId).toBe(actorA);

    const contactsA = await callerA.message.contactList();
    const contactsB = await callerB.message.contactList();
    expect(contactsA.items).toEqual([
      expect.objectContaining({
        sourceId: "source-b",
        remoteActorId: actorB,
      }),
    ]);
    expect(contactsB.items).toEqual([
      expect.objectContaining({
        sourceId: "source-a",
        remoteActorId: actorA,
      }),
    ]);
  });

  test("Scenario: Given a contact request is accepted with firstChat When paired direct rooms bootstrap Then both sides see the first message and inviting a third actor branches into a public room", async () => {
    const handleA = await startHandle(ROOT_AUTH_PRIVATE_KEY_A);
    const handleB = await startHandle(ROOT_AUTH_PRIVATE_KEY_B);
    const { caller: callerA, session: sessionA } = await createAuthedCaller(handleA);
    const { caller: callerB, session: sessionB } = await createAuthedCaller(handleB);
    const actorA = `auth:${sessionA.claims.authId}` as const;
    const actorB = `auth:${sessionB.claims.authId}` as const;

    await callerA.message.sourceUpsert({
      sourceId: "source-b",
      label: "B",
      endpoint: endpointOf(handleB),
      authToken: sessionB.token,
      callbackSourceId: "source-a",
      callbackEndpoint: endpointOf(handleA),
    });
    await callerB.message.sourceUpsert({
      sourceId: "source-a",
      label: "A",
      endpoint: endpointOf(handleA),
      authToken: sessionA.token,
      callbackSourceId: "source-b",
      callbackEndpoint: endpointOf(handleB),
    });

    const sent = await callerA.message.contactRequestSend({
      sourceId: "source-b",
      remoteActorId: actorB,
    });
    const accepted = await callerB.message.acceptContactRequest({
      requestId: sent.request.requestId,
      firstChat: "hello from B",
    });
    const directB = accepted.result.localDirectChatId;
    const directA = accepted.result.remoteDirectChatId;

    expect(directB).toBeTruthy();
    expect(directA).toBeTruthy();
    if (!directA || !directB) {
      throw new Error("expected paired direct room ids");
    }

    const snapshotA = await callerA.message.globalSnapshot({
      chatId: directA,
    });
    const snapshotB = await callerB.message.globalSnapshot({
      chatId: directB,
    });
    expect(snapshotA.channel.metadata?.roomMode).toBe("direct");
    expect(snapshotB.channel.metadata?.roomMode).toBe("direct");
    expect(snapshotA.channel.metadata?.remoteDirectChatId).toBe(directB);
    expect(snapshotB.channel.metadata?.remoteDirectChatId).toBe(directA);
    expect(snapshotA.items.at(-1)).toMatchObject({
      content: "hello from B",
      senderActorId: actorB,
    });
    expect(snapshotB.items.at(-1)).toMatchObject({
      content: "hello from B",
      senderActorId: actorB,
    });

    const invited = await callerA.message.inviteParticipant({
      chatId: directA,
      invitedActorId: "auth:carol",
      invitedLabel: "Carol",
    });
    expect(invited.room.chatId).not.toBe(directA);
    expect(invited.room.metadata?.roomMode).toBe("public");
    expect(invited.room.metadata?.createdFromDirectRoomId).toBe(directA);
  });
});
