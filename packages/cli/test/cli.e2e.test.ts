import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

const CLI_ENTRY = resolve(import.meta.dir, "../src/bin/agenter.ts");
const WEBUI_PACKAGE_DIR = resolve(import.meta.dir, "../../webui");
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

const tempHomes: string[] = [];

const createIsolatedHome = (): string => {
  const home = mkdtempSync(resolve(tmpdir(), "agenter-cli-e2e-"));
  tempHomes.push(home);
  return home;
};

const spawnCli = (args: string[], envOverrides: Record<string, string> = {}) =>
  Bun.spawn({
    cmd: [BUN_BIN, "run", CLI_ENTRY, ...args],
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

const daemons: Array<Bun.Subprocess<"ignore", "pipe", "pipe">> = [];

afterEach(async () => {
  for (const daemon of daemons.splice(0)) {
    daemon.kill();
    await daemon.exited;
  }
  for (const home of tempHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

const waitForHealth = async (host: string, port: number, timeoutMs = 45_000): Promise<boolean> => {
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

const waitForWsOpen = async (url: string, timeoutMs = 15_000): Promise<void> => {
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

const waitFor = async (predicate: () => boolean, timeoutMs = 12_000): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timeout waiting for condition");
};

const runPlaywrightProbe = async (url: string): Promise<{ url: string; body: string; errors: string[] }> => {
  const script = `
    import { chromium } from "playwright";

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(\`console:\${msg.text()}\`);
    });
    page.on("pageerror", (err) => errors.push(\`pageerror:\${err.message}\`));
    await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    console.log(JSON.stringify({
      url: page.url(),
      body: await page.locator("body").innerText(),
      errors,
    }));
    await browser.close();
  `;
  const probe = Bun.spawn({
    cmd: ["pnpm", "exec", "node", "--input-type=module", "-e", script],
    cwd: WEBUI_PACKAGE_DIR,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
    },
  });
  const code = await probe.exited;
  const stdout = await readText(probe.stdout);
  const stderr = await readText(probe.stderr);
  if (code !== 0) {
    throw new Error(`playwright probe failed (${code}): ${stderr || stdout}`);
  }
  const jsonLine = stdout
    .trim()
    .split(/\r?\n/u)
    .reverse()
    .find((line) => line.trim().startsWith("{"));
  if (!jsonLine) {
    throw new Error(`playwright probe produced no JSON payload: ${stdout || stderr}`);
  }
  return JSON.parse(jsonLine) as { url: string; body: string; errors: string[] };
};

const expectSvelteShellHtml = (html: string): void => {
  expect(html.includes("<!doctype html>")).toBe(true);
  expect(html.includes('data-sveltekit-preload-data="hover"')).toBe(true);
  expect(html.includes("/_app/")).toBe(true);
};

describe("Feature: cli daemon and web commands", () => {
  test("Scenario: Given daemon command When doctor checks health Then exit code is 0", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    const daemon = spawnCli(["daemon", "--host", host, "--port", String(port)], { HOME: home });
    daemons.push(daemon);

    const healthy = await waitForHealth(host, port);
    if (!healthy) {
      const stderr = await readText(daemon.stderr);
      throw new Error(`daemon failed to become healthy: ${stderr}`);
    }

    const doctor = spawnCli(["doctor", "--host", host, "--port", String(port)], { HOME: home });
    const doctorCode = await doctor.exited;
    const doctorStdout = await readText(doctor.stdout);

    expect(doctorCode).toBe(0);
    expect(doctorStdout.includes("healthy")).toBe(true);
  }, 70_000);

  test("Scenario: Given a standalone auth-service endpoint When daemon reuses it Then auth descriptor stays external and the single writer is not started twice", async () => {
    const host = "127.0.0.1";
    const authPort = await findFreePort();
    const daemonPort = await findFreePort();
    const home = createIsolatedHome();
    const authService = spawnCli(["auth-service", "--host", host, "--port", String(authPort)], { HOME: home });
    daemons.push(authService);

    const authHealthy = await waitForHealth(host, authPort);
    if (!authHealthy) {
      const stderr = await readText(authService.stderr);
      throw new Error(`auth-service failed to become healthy: ${stderr}`);
    }

    const daemon = spawnCli(
      ["daemon", "--host", host, "--port", String(daemonPort), "--auth-service-endpoint", `http://${host}:${authPort}`],
      { HOME: home },
    );
    daemons.push(daemon);

    const daemonHealthy = await waitForHealth(host, daemonPort);
    if (!daemonHealthy) {
      const stderr = await readText(daemon.stderr);
      throw new Error(`daemon failed to become healthy: ${stderr}`);
    }

    const client = createAgenterClient({
      wsUrl: `ws://${host}:${daemonPort}/trpc`,
    });
    try {
      const descriptor = await client.trpc.auth.service.query();
      expect(descriptor.endpoint).toBe(`http://${host}:${authPort}`);
      expect(descriptor.rootAuthBootstrapMode).toBe("external");
      expect(descriptor.canRevealRootAuthPrivateKey).toBe(false);
      expect(descriptor.hasManagedRootAuthPrivateKey).toBe(false);
    } finally {
      client.close();
    }
  }, 70_000);

  test("Scenario: Given a healthy standalone local auth-service When daemon boots on the same authority root without an explicit endpoint Then it auto-reuses the discovered authority", async () => {
    const host = "127.0.0.1";
    const authPort = await findFreePort();
    const daemonPort = await findFreePort();
    const home = createIsolatedHome();
    const authService = spawnCli(["auth-service", "--host", host, "--port", String(authPort)], { HOME: home });
    daemons.push(authService);

    const authHealthy = await waitForHealth(host, authPort);
    if (!authHealthy) {
      const stderr = await readText(authService.stderr);
      throw new Error(`auth-service failed to become healthy: ${stderr}`);
    }

    const daemon = spawnCli(["daemon", "--host", host, "--port", String(daemonPort)], { HOME: home });
    daemons.push(daemon);

    const daemonHealthy = await waitForHealth(host, daemonPort);
    if (!daemonHealthy) {
      const stderr = await readText(daemon.stderr);
      throw new Error(`daemon failed to become healthy: ${stderr}`);
    }

    const client = createAgenterClient({
      wsUrl: `ws://${host}:${daemonPort}/trpc`,
    });
    try {
      const descriptor = await client.trpc.auth.service.query();
      expect(descriptor.endpoint).toBe(`http://${host}:${authPort}`);
      expect(descriptor.rootAuthBootstrapMode).toBe("external");
      expect(descriptor.canRevealRootAuthPrivateKey).toBe(false);
      expect(descriptor.hasManagedRootAuthPrivateKey).toBe(false);
    } finally {
      client.close();
    }
  }, 70_000);

  test("Scenario: Given web command When reading root html Then the default entry serves the canonical Svelte shell", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    const daemon = spawnCli(["web", "--host", host, "--port", String(port)], { HOME: home });
    daemons.push(daemon);

    const healthy = await waitForHealth(host, port);
    if (!healthy) {
      const stderr = await readText(daemon.stderr);
      throw new Error(`web daemon failed to become healthy: ${stderr}`);
    }

    const response = await fetch(`http://${host}:${port}/`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expectSvelteShellHtml(html);
    await waitForWsOpen(`ws://${host}:${port}/trpc`);
  }, 70_000);

  test("Scenario: Given static web command When a browser opens the root entry Then it hydrates and redirects without HTML-as-JSON failure", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    const daemon = spawnCli(["web", "--host", host, "--port", String(port)], { HOME: home });
    daemons.push(daemon);

    const healthy = await waitForHealth(host, port);
    if (!healthy) {
      const stderr = await readText(daemon.stderr);
      throw new Error(`web daemon failed to become healthy: ${stderr}`);
    }

    const probe = await runPlaywrightProbe(`http://${host}:${port}/`);
    expect(probe.url).toMatch(/\/avatars\/workspace(?:\?.*)?$/);
    expect(probe.errors).toEqual([]);
    expect(probe.body.trim().length).toBeGreaterThan(0);
  }, 120_000);

  test("Scenario: Given web command When refreshing room and attention deep links Then the default entry returns the same SPA shell instead of 404", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    const daemon = spawnCli(["web", "--host", host, "--port", String(port)], { HOME: home });
    daemons.push(daemon);

    const healthy = await waitForHealth(host, port);
    if (!healthy) {
      const stderr = await readText(daemon.stderr);
      throw new Error(`web daemon failed to become healthy: ${stderr}`);
    }

    const roomResponse = await fetch(`http://${host}:${port}/messages/room/test-room?sessionId=test-session`);
    const roomHtml = await roomResponse.text();
    expect(roomResponse.status).toBe(200);
    expectSvelteShellHtml(roomHtml);

    const attentionResponse = await fetch(`http://${host}:${port}/avatars/runtime/test-session/attention`);
    const attentionHtml = await attentionResponse.text();
    expect(attentionResponse.status).toBe(200);
    expectSvelteShellHtml(attentionHtml);
  }, 70_000);

  test("Scenario: Given daemon and runtime store When creating session Then subscription syncs state", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    const daemon = spawnCli(["daemon", "--host", host, "--port", String(port)], { HOME: home });
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
      await store.createSession({
        cwd: process.cwd(),
        name: "e2e-subscription",
        autoStart: false,
      });
      await waitFor(() => store.getState().sessions.some((item) => item.name === "e2e-subscription"));
      expect(store.getState().sessions.some((item) => item.name === "e2e-subscription")).toBe(true);
    } finally {
      store.disconnect();
    }
  }, 90_000);
});
