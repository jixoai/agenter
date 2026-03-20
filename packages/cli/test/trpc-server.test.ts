import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgenterClient } from "@agenter/client-sdk";

import { startTrpcServer, type TrpcServerHandle } from "../src/trpc-server";

const tempDirs: string[] = [];
const handles: TrpcServerHandle[] = [];
const clients: Array<ReturnType<typeof createAgenterClient>> = [];

const createWorkspaceRoot = () => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-cli-server-"));
  tempDirs.push(dir);
  const workspace = join(dir, "workspace");
  mkdirSync(workspace, { recursive: true });
  return { dir, workspace };
};

afterEach(async () => {
  while (clients.length > 0) {
    clients.pop()?.close();
  }
  while (handles.length > 0) {
    const handle = handles.pop();
    if (handle) {
      await handle.stop();
    }
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Feature: trpc server media routes", () => {
  test("Scenario: Given session asset uploads When posting supported files Then image and file assets are persisted and retrievable", async () => {
    const { dir, workspace } = createWorkspaceRoot();
    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath: join(dir, "workspaces.yaml"),
    });
    handles.push(handle);

    const client = createAgenterClient({
      wsUrl: `ws://${handle.host}:${handle.port}/trpc`,
    });
    clients.push(client);

    const created = await client.trpc.session.create.mutate({
      cwd: workspace,
      autoStart: false,
    });

    const form = new FormData();
    form.append("files", new File([new Uint8Array([137, 80, 78, 71])], "diagram.png", { type: "image/png" }));
    form.append("files", new File(["hello"], "notes.txt", { type: "text/plain" }));
    const uploadResponse = await fetch(
      `http://${handle.host}:${handle.port}/api/sessions/${encodeURIComponent(created.session.id)}/assets`,
      {
        method: "POST",
        body: form,
      },
    );
    const uploadPayload = (await uploadResponse.json()) as {
      ok: boolean;
      items?: Array<{ assetId: string; url: string; mimeType: string }>;
      error?: string;
    };

    expect(uploadResponse.status).toBe(200);
    expect(uploadPayload.ok).toBe(true);
    expect(uploadPayload.items).toHaveLength(2);
    expect(uploadPayload.items?.[0]?.mimeType).toBe("image/png");
    expect(uploadPayload.items?.[1]?.mimeType).toContain("text/plain");

    const asset = uploadPayload.items?.[0];
    if (!asset) {
      throw new Error("expected uploaded asset metadata");
    }

    const mediaResponse = await fetch(`http://${handle.host}:${handle.port}${asset.url}`);
    const mediaBytes = new Uint8Array(await mediaResponse.arrayBuffer());
    expect(mediaResponse.status).toBe(200);
    expect(mediaResponse.headers.get("content-type")).toBe("image/png");
    expect([...mediaBytes]).toEqual([137, 80, 78, 71]);
  });

  test("Scenario: Given cross-origin HTTP tRPC queries When requesting runtime snapshot Then the /trpc prefix is rewritten and CORS headers are present", async () => {
    const { dir } = createWorkspaceRoot();
    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath: join(dir, "workspaces.yaml"),
    });
    handles.push(handle);

    const response = await fetch(
      `http://${handle.host}:${handle.port}/trpc/runtime.snapshot?batch=1&input=${encodeURIComponent(
        JSON.stringify({ 0: { json: null } }),
      )}`,
      {
        headers: {
          origin: "http://127.0.0.1:4273",
        },
      },
    );
    const payload = (await response.json()) as Array<{
      result?: {
        data?: {
          json?: {
            version: number;
            sessions: unknown[];
          };
        };
      };
    }>;

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(payload[0]?.result?.data?.json?.version).toBe(1);
    expect(Array.isArray(payload[0]?.result?.data?.json?.sessions)).toBe(true);
  });
});
