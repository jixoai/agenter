import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

import { AppKernel, appRouter, createTrpcContext } from "../src";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-message-query-router-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const ROOT_AUTH_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1";

const createAuthCaller = async (kernel: AppKernel, account: PrivateKeyAccount) => {
  const anonymousCaller = appRouter.createCaller(await createTrpcContext(kernel));
  const challenge = await anonymousCaller.auth.challengeStart({
    authId: account.address.toLowerCase(),
  });
  const signature = await account.signMessage({
    message: challenge.challengeText,
  });
  const session = await anonymousCaller.auth.challengeVerify({
    challengeId: challenge.challengeId,
    signature,
  });
  return appRouter.createCaller(
    await createTrpcContext({
      kernel,
      authorizationHeader: `Bearer ${session.token}`,
    }),
  );
};

const createRootSuperadminCaller = async (kernel: AppKernel) =>
  await createAuthCaller(kernel, privateKeyToAccount(ROOT_AUTH_PRIVATE_KEY));

describe("Feature: app-server message query", () => {
  test("Scenario: Given auth-scoped room grants When message.query searches all rooms Then only currently authorized room history is returned", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();

    const rootCaller = await createRootSuperadminCaller(kernel);
    const viewerAccount = privateKeyToAccount(generatePrivateKey());
    const viewerCaller = await createAuthCaller(kernel, viewerAccount);
    const viewerActorId = `auth:${viewerAccount.address.toLowerCase()}` as const;

    const allowed = await rootCaller.message.globalCreate({
      title: "Allowed room",
    });
    const forbidden = await rootCaller.message.globalCreate({
      title: "Forbidden room",
    });

    await rootCaller.message.globalIssueGrant({
      chatId: allowed.channel.chatId,
      role: "readonly",
      participantId: viewerActorId,
    });

    await rootCaller.message.globalSend({
      chatId: allowed.channel.chatId,
      text: "budget incident alpha",
    });
    await rootCaller.message.globalSend({
      chatId: forbidden.channel.chatId,
      text: "budget incident beta",
    });

    const result = await viewerCaller.message.query({
      chatId: "*",
      mode: "match",
      query: "budget incident",
    });

    expect(result.resultKind).toBe("messages");
    if (result.resultKind !== "messages") {
      throw new Error("expected message result");
    }
    expect(result.chatIds).toEqual([allowed.channel.chatId]);
    expect(result.items.map((item) => item.chatId)).toEqual([allowed.channel.chatId]);

    await kernel.stop();
  });
});
