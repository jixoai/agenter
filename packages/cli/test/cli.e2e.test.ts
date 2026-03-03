import { afterEach, describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { resolve } from "node:path";

import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

const CLI_ENTRY = resolve(import.meta.dir, "../src/bin/agenter.ts");
const BUN_BIN = Bun.which("bun") ?? process.execPath;

const readText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> => {
  if (!stream) {
    return "";
  }
  return await new Response(stream).text();
};

const findFreePort = async (): Promise<number> =>
  await new Promise<number>((resolveReady, rejectReady) => {
    const server = createServer();
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => rejectReady(new Error("failed to allocate port")));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          rejectReady(error);
          return;
        }
        resolveReady(port);
      });
    });
  });

const spawnCli = (...args: string[]) =>
  Bun.spawn({
    cmd: [BUN_BIN, "run", CLI_ENTRY, ...args],
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

const daemons: Subprocess[] = [];

afterEach(async () => {
  for (const daemon of daemons.splice(0)) {
    daemon.kill();
    await daemon.exited;
  }
});

const waitForHealth = async (host: string, port: number, timeoutMs = 8_000): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://${host}:${port}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // noop
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
};

const waitForWsOpen = async (url: string, timeoutMs = 8_000): Promise<void> => {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`websocket timeout: ${url}`));
    }, timeoutMs);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`websocket connect error: ${url}`));
    });
  });
  socket.close();
};

const waitFor = async (predicate: () => boolean, timeoutMs = 8_000): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timeout waiting for condition");
};

describe("Feature: cli daemon and web commands", () => {
  test("Scenario: Given daemon command When doctor checks health Then exit code is 0", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const daemon = spawnCli("daemon", "--host", host, "--port", String(port));
    daemons.push(daemon);

    const healthy = await waitForHealth(host, port);
    if (!healthy) {
      const stderr = await readText(daemon.stderr);
      throw new Error(`daemon failed to become healthy: ${stderr}`);
    }

    const doctor = spawnCli("doctor", "--host", host, "--port", String(port));
    const doctorCode = await doctor.exited;
    const doctorStdout = await readText(doctor.stdout);

    expect(doctorCode).toBe(0);
    expect(doctorStdout.includes("healthy")).toBe(true);
  });

  test("Scenario: Given web command When reading root html Then include web ui shell content", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const daemon = spawnCli("web", "--host", host, "--port", String(port));
    daemons.push(daemon);

    const healthy = await waitForHealth(host, port);
    if (!healthy) {
      const stderr = await readText(daemon.stderr);
      throw new Error(`web daemon failed to become healthy: ${stderr}`);
    }

    const html = await fetch(`http://${host}:${port}/`).then((response) => response.text());
    expect(html.includes("Agenter WebUI")).toBe(true);
    await waitForWsOpen(`ws://${host}:${port}/trpc`);
  });

  test("Scenario: Given daemon and runtime store When creating instance Then subscription syncs state", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const daemon = spawnCli("daemon", "--host", host, "--port", String(port));
    daemons.push(daemon);

    const healthy = await waitForHealth(host, port);
    if (!healthy) {
      const stderr = await readText(daemon.stderr);
      throw new Error(`daemon failed to become healthy: ${stderr}`);
    }

    const client = createAgenterClient({
      wsUrl: `ws://${host}:${port}/trpc`,
    });
    const store = createRuntimeStore(client);
    try {
      await store.connect();
      await store.createInstance({
        cwd: process.cwd(),
        name: "e2e-subscription",
        autoStart: false,
      });
      await waitFor(() => store.getState().instances.some((item) => item.name === "e2e-subscription"));
      expect(store.getState().instances.some((item) => item.name === "e2e-subscription")).toBe(true);
    } finally {
      store.disconnect();
    }
  });
});
