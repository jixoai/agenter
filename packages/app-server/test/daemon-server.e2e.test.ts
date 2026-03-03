import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDaemonServer, type DaemonEvent } from "../src";

const newRequestId = (): string => `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

class WsClient {
  private readonly queue: unknown[] = [];
  private readonly waiters: Array<(value: unknown) => void> = [];
  private readonly socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as unknown;
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter(payload);
        return;
      }
      this.queue.push(payload);
    });
  }

  static async connect(url: string): Promise<WsClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`websocket timeout: ${url}`));
      }, 8_000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error(`websocket connect error: ${url}`));
      });
    });
    return new WsClient(socket);
  }

  send(value: Record<string, unknown>): void {
    this.socket.send(JSON.stringify(value));
  }

  async nextMatching(
    predicate: (payload: unknown) => boolean,
    timeoutMs = 8_000,
  ): Promise<Record<string, unknown>> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const next = await this.nextRaw(Math.max(1, deadline - Date.now()));
      if (predicate(next)) {
        return next as Record<string, unknown>;
      }
    }
    throw new Error("websocket message timeout");
  }

  close(): void {
    this.socket.close();
  }

  private async nextRaw(timeoutMs: number): Promise<unknown> {
    if (this.queue.length > 0) {
      return this.queue.shift() as unknown;
    }
    return await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiters.indexOf(resolve);
        if (index >= 0) {
          this.waiters.splice(index, 1);
        }
        reject(new Error("websocket receive timeout"));
      }, timeoutMs);
      this.waiters.push((value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
  }
}

const tempDirs: string[] = [];

const makeTempDir = (name: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `${name}-`));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: daemon server end-to-end lifecycle", () => {
  test("Scenario: Given running daemon When websocket client manages instance Then lifecycle events and acks are consistent", async () => {
    const root = makeTempDir("agenter-daemon-e2e");
    const registryPath = join(root, "instances.json");
    const workspace = join(root, "workspace");

    const daemon = createDaemonServer({
      host: "127.0.0.1",
      port: 0,
      registryPath,
    });
    const address = await daemon.start();

    const health = await fetch(`http://${address.host}:${address.port}/health`).then((res) => res.json());
    expect(health.ok).toBe(true);
    expect(typeof health.port).toBe("number");

    const ws = await WsClient.connect(`ws://${address.host}:${address.port}/ws`);
    const snapshot = await ws.nextMatching((payload) => {
      const msg = payload as Partial<DaemonEvent>;
      return msg.type === "instance.snapshot";
    });
    expect(snapshot.type).toBe("instance.snapshot");

    const createReqId = newRequestId();
    ws.send({
      type: "instance.create",
      requestId: createReqId,
      payload: {
        cwd: workspace,
        name: "e2e-workspace",
        autoStart: false,
      },
    });

    const createAck = await ws.nextMatching((payload) => {
      const msg = payload as Record<string, unknown>;
      return msg.type === "ack" && msg.requestId === createReqId;
    });
    expect(createAck.ok).toBe(true);
    const created = createAck.data as { instance: { id: string; name: string; status: string } };
    expect(created.instance.name).toBe("e2e-workspace");
    expect(created.instance.status).toBe("stopped");

    const listReqId = newRequestId();
    ws.send({ type: "instance.list", requestId: listReqId });
    const listAck = await ws.nextMatching((payload) => {
      const msg = payload as Record<string, unknown>;
      return msg.type === "ack" && msg.requestId === listReqId;
    });
    expect(listAck.ok).toBe(true);
    const list = listAck.data as { instances: Array<{ id: string }> };
    expect(list.instances.some((item) => item.id === created.instance.id)).toBe(true);

    const deleteReqId = newRequestId();
    ws.send({
      type: "instance.delete",
      requestId: deleteReqId,
      payload: { instanceId: created.instance.id },
    });

    const deleteAck = await ws.nextMatching((payload) => {
      const msg = payload as Record<string, unknown>;
      return msg.type === "ack" && msg.requestId === deleteReqId;
    });
    expect(deleteAck.ok).toBe(true);

    await wait(20);
    ws.close();
    await daemon.stop();
  });

  test("Scenario: Given web ui html provider When opening root path Then server returns configured html", async () => {
    const root = makeTempDir("agenter-daemon-web-e2e");
    const registryPath = join(root, "instances.json");

    const daemon = createDaemonServer({
      host: "127.0.0.1",
      port: 0,
      registryPath,
      webUiHtml: () => "<!doctype html><html><body>Agenter E2E</body></html>",
    });
    const address = await daemon.start();

    const response = await fetch(`http://${address.host}:${address.port}/`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html.includes("Agenter E2E")).toBe(true);

    await daemon.stop();
  });
});
