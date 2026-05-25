import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { request as httpRequest } from "node:http";

import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

const CLI_ENTRY = resolve(import.meta.dir, "../src/bin/agenter.ts");
const STUDIO_PACKAGE_DIR = resolve(import.meta.dir, "../../studio");
const BUN_BIN = Bun.which("bun") ?? process.execPath;

const readText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> => {
  if (!stream) {
    return "";
  }
  return await new Response(stream).text();
};

const readUntilMatch = async (
  stream: ReadableStream<Uint8Array> | null,
  pattern: RegExp,
  timeoutMs = 30_000,
): Promise<string> => {
  if (!stream) {
    throw new Error("expected readable stream");
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  const startedAt = Date.now();
  try {
    for (;;) {
      if (pattern.test(output)) {
        return output;
      }
      const remainingMs = timeoutMs - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        throw new Error(`timed out waiting for pattern ${pattern}`);
      }
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`timed out waiting for pattern ${pattern}`)), remainingMs),
        ),
      ]);
      if (result.done) {
        if (pattern.test(output)) {
          return output;
        }
        throw new Error(`stream ended before pattern matched: ${pattern}\n${output}`);
      }
      output += decoder.decode(result.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
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

const runCliToCompletion = async (args: string[], envOverrides: Record<string, string> = {}) => {
  const child = spawnCli(args, envOverrides);
  const code = await child.exited;
  const stdout = await readText(child.stdout);
  const stderr = await readText(child.stderr);
  return { code, stdout, stderr };
};

const startManagedDaemon = async (input: { host: string; port: number; home: string; extraArgs?: string[] }) => {
  const result = await runCliToCompletion(
    ["daemon", "start", "--host", input.host, "--port", String(input.port), ...(input.extraArgs ?? [])],
    { HOME: input.home },
  );
  if (result.code !== 0) {
    throw new Error(`daemon start failed (${result.code}): ${result.stderr || result.stdout}`);
  }
  const healthy = await waitForHealth(input.host, input.port);
  if (!healthy) {
    throw new Error(`daemon failed to become healthy after start: ${result.stderr || result.stdout}`);
  }
  return result;
};

const stopManagedDaemon = async (input: { host: string; port: number; home: string }) =>
  await runCliToCompletion(["daemon", "stop", "--host", input.host, "--port", String(input.port)], { HOME: input.home });

const readManagedDaemonDescriptor = (home: string): { pid: number } => {
  const descriptor = JSON.parse(readFileSync(resolve(home, ".agenter", "daemon.runtime.json"), "utf8")) as {
    pid?: unknown;
  };
  if (typeof descriptor.pid !== "number" || !Number.isInteger(descriptor.pid) || descriptor.pid <= 0) {
    throw new Error("daemon descriptor does not contain a valid pid");
  }
  return {
    pid: descriptor.pid,
  };
};

const killManagedDaemonAbruptly = async (home: string): Promise<void> => {
  const descriptor = readManagedDaemonDescriptor(home);
  try {
    process.kill(descriptor.pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== "ESRCH") {
      throw error;
    }
  }
  await waitFor(() => {
    try {
      process.kill(descriptor.pid, 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException | undefined)?.code === "ESRCH";
    }
  }, 15_000);
};

afterEach(async () => {
  for (const daemon of daemons.splice(0)) {
    daemon.kill();
    await daemon.exited;
  }
  for (const home of tempHomes) {
    await stopManagedDaemon({ host: "127.0.0.1", port: 0, home });
  }
  for (const home of tempHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

const waitForHealth = async (host: string, port: number, timeoutMs = 45_000): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const statusCode = await new Promise<number | undefined>((resolveResponse, rejectResponse) => {
        const req = httpRequest(
          `http://${host}:${port}/health`,
          {
            method: "GET",
            timeout: 5_000,
          },
          (response) => {
            response.resume();
            resolveResponse(response.statusCode);
          },
        );
        req.on("error", rejectResponse);
        req.on("timeout", () => {
          req.destroy();
          rejectResponse(new Error("timeout"));
        });
        req.end();
      });
      if (typeof statusCode === "number" && statusCode >= 200 && statusCode < 300) {
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

const waitFor = async (predicate: () => boolean | Promise<boolean>, timeoutMs = 12_000): Promise<void> => {
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
    await page.goto(${JSON.stringify(url)}, { waitUntil: "load" });
    await page.waitForURL(/\\/avatars\\/catalog(?:\\?.*)?$/, { timeout: 30000 });
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
    cwd: STUDIO_PACKAGE_DIR,
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
  expect(html.includes("/_app/") || html.includes("__sveltekit_dev")).toBe(true);
};

const startStudioDev = async (input: { host: string; home: string; webPort: number; daemonPort: number }) => {
  const studio = spawnCli(
    ["studio", "--dev", "--web-port", String(input.webPort), "--port", String(input.daemonPort)],
    { HOME: input.home },
  );
  daemons.push(studio);
  await readUntilMatch(studio.stdout, new RegExp(`agenter studio \\(dev\\) ui:\\s+http://${input.host}:${input.webPort}`, "u"), 90_000);
  return studio;
};

describe("Feature: cli daemon and Studio commands", () => {
  test("Scenario: Given daemon command When doctor checks health Then exit code is 0", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    const startResult = await startManagedDaemon({ host, port, home });

    const doctor = spawnCli(["doctor", "--host", host, "--port", String(port)], { HOME: home });
    const doctorCode = await doctor.exited;
    const doctorStdout = await readText(doctor.stdout);

    expect(doctorCode).toBe(0);
    expect(doctorStdout.includes("healthy")).toBe(true);
    expect(startResult.stdout).toContain("daemon log: ");
    const logPath = startResult.stdout.match(/daemon log: (.+)/u)?.[1]?.trim();
    expect(logPath).toBeDefined();
    expect(logPath?.startsWith(`${home}/.agenter/logs/daemon/`)).toBe(true);
    expect(existsSync(logPath ?? "")).toBe(true);
  }, 70_000);

  test("Scenario: Given daemon start and stop commands When stop is invoked Then the managed daemon exits and doctor reports unreachable", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    await startManagedDaemon({ host, port, home });

    const stopResult = await stopManagedDaemon({ host, port, home });

    expect(stopResult.code).toBe(0);
    expect(stopResult.stdout).toContain(`stopped agenter daemon on ${host}:${port}`);
    await waitFor(async () => !(await waitForHealth(host, port, 500)), 15_000);

    const doctor = spawnCli(["doctor", "--host", host, "--port", String(port)], { HOME: home });
    const doctorCode = await doctor.exited;
    const doctorStdout = await readText(doctor.stdout);

    expect(doctorCode).toBe(1);
    expect(doctorStdout).toContain("not reachable");
  }, 90_000);

  test("Scenario: Given daemon restart command When restart is invoked Then the managed daemon returns on the same authority", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    await startManagedDaemon({ host, port, home });

    const restartResult = await runCliToCompletion(["daemon", "restart", "--host", host, "--port", String(port)], { HOME: home });
    expect(restartResult.code).toBe(0);
    expect(restartResult.stdout).toContain(`agenter daemon started in background on ${host}:${port}`);

    const restarted = await waitForHealth(host, port);
    if (!restarted) {
      throw new Error(`daemon failed to restart healthy after background launch: ${restartResult.stderr}`);
    }

    const doctor = spawnCli(["doctor", "--host", host, "--port", String(port)], { HOME: home });
    const doctorCode = await doctor.exited;
    const doctorStdout = await readText(doctor.stdout);

    expect(doctorCode).toBe(0);
    expect(doctorStdout).toContain("healthy");
  }, 90_000);

  test("Scenario: Given a live terminal and abrupt daemon death When daemon starts again Then stale terminal leaves live projection and enters killed history", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    await startManagedDaemon({ host, port, home });

    const client = createAgenterClient({
      wsUrl: `ws://${host}:${port}/trpc`,
    });
    try {
      const autoLogin = await client.trpc.auth.autoLogin.mutate();
      if (!autoLogin.ok) {
        throw new Error(`expected daemon auto login to succeed, got ${autoLogin.reason}: ${autoLogin.message}`);
      }
      client.setAuthToken(autoLogin.session.token);

      const terminalId = "daemon-abrupt-recovery";
      const created = await client.trpc.terminal.globalCreate.mutate({
        terminalId,
        command: ["sh", "-lc", "sleep 300"],
        start: true,
        focus: false,
      });
      expect(created.result.ok).toBe(true);
      expect((await client.trpc.terminal.globalList.query()).items.some((item) => item.terminalId === terminalId)).toBe(true);
    } finally {
      client.close();
    }

    await killManagedDaemonAbruptly(home);
    await startManagedDaemon({ host, port, home });

    const recoveredClient = createAgenterClient({
      wsUrl: `ws://${host}:${port}/trpc`,
    });
    try {
      const autoLogin = await recoveredClient.trpc.auth.autoLogin.mutate();
      if (!autoLogin.ok) {
        throw new Error(`expected daemon auto login to succeed, got ${autoLogin.reason}: ${autoLogin.message}`);
      }
      recoveredClient.setAuthToken(autoLogin.session.token);

      const live = await recoveredClient.trpc.terminal.globalList.query();
      const history = await recoveredClient.trpc.terminal.globalHistory.query();
      const index = await recoveredClient.trpc.terminal.globalIndex.query();
      const archive = await recoveredClient.trpc.terminal.globalArchiveList.query();

      expect(live.items.some((item) => item.terminalId === "daemon-abrupt-recovery")).toBe(false);
      expect(history.items.find((item) => item.terminalId === "daemon-abrupt-recovery")?.processPhase).toBe("killed");
      expect(index.items.find((item) => item.terminalId === "daemon-abrupt-recovery")?.processPhase).toBe("killed");
      expect(archive.items.some((item) => item.terminalId === "daemon-abrupt-recovery")).toBe(false);
    } finally {
      recoveredClient.close();
    }
  }, 120_000);

  test("Scenario: Given daemon is already running on the requested authority When start is invoked again Then the command reports reuse instead of starting another writer", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    await startManagedDaemon({ host, port, home });

    const secondStart = await runCliToCompletion(["daemon", "start", "--host", host, "--port", String(port)], { HOME: home });

    expect(secondStart.code).toBe(0);
    expect(secondStart.stdout).toContain(`agenter daemon already running on ${host}:${port}`);
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

    await startManagedDaemon({
      host,
      port: daemonPort,
      home,
      extraArgs: ["--auth-service-endpoint", `http://${host}:${authPort}`],
    });

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

    await startManagedDaemon({ host, port: daemonPort, home });

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

  test("Scenario: Given a healthy daemon already owns the runtime root on a different port When `agenter shell shell` starts through the default launcher path Then the launcher reuses that daemon authority instead of booting a competing writer", async () => {
    const host = "127.0.0.1";
    const daemonPort = await findFreePort();
    const home = createIsolatedHome();
    await startManagedDaemon({ host, port: daemonPort, home });

    const shell = spawnCli(["shell", "shell", "--session=e2e-reuse", "--avatar=e2e-reuse", "--create-avatar"], {
      HOME: home,
    });

    const code = await shell.exited;
    const stdout = await readText(shell.stdout);
    const stderr = await readText(shell.stderr);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("cli-shell shell attached");
    expect(stdout).toContain("avatar: e2e-reuse");
  }, 70_000);

  test("Scenario: Given the runtime root contains a stale daemon descriptor When `agenter shell shell` starts Then launcher bootstrap ignores the stale descriptor and still reaches the selected shell", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    const staleDir = resolve(home, ".agenter");
    mkdirSync(staleDir, { recursive: true });
    writeFileSync(
      resolve(staleDir, "daemon.runtime.json"),
      `${JSON.stringify({
        pid: process.pid + 9999,
        host,
        port: 65501,
        endpoint: `http://${host}:65501`,
        homeDir: home,
        updatedAt: new Date().toISOString(),
      })}\n`,
      "utf8",
    );

    const shell = spawnCli(
      ["shell", "shell", "--port", String(port), "--session=e2e-stale", "--avatar=e2e-stale", "--create-avatar"],
      { HOME: home },
    );

    const code = await shell.exited;
    const stdout = await readText(shell.stdout);
    const stderr = await readText(shell.stderr);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("cli-shell shell attached");
    expect(stdout).toContain("avatar: e2e-stale");
  }, 70_000);

  test("Scenario: Given removed web command When invoking the old entry Then the CLI rejects it as an unsupported product", async () => {
    const home = createIsolatedHome();
    const web = spawnCli(["web", "--help"], { HOME: home });

    const code = await web.exited;
    const stderr = await readText(web.stderr);

    expect(code).toBe(1);
    expect(stderr).toContain("unsupported product command: web");
  }, 30_000);

  test("Scenario: Given Studio product command When reading root html Then the product-owned dev server serves the canonical Svelte shell", async () => {
    const host = "127.0.0.1";
    const webPort = await findFreePort();
    const daemonPort = await findFreePort();
    const home = createIsolatedHome();
    await startStudioDev({ host, home, webPort, daemonPort });

    const response = await fetch(`http://${host}:${webPort}/`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expectSvelteShellHtml(html);

    await waitForWsOpen(`ws://${host}:${daemonPort}/trpc`);
  }, 70_000);

  test("Scenario: Given Studio product command When a browser opens the root entry Then it hydrates and redirects without HTML-as-JSON failure", async () => {
    const host = "127.0.0.1";
    const webPort = await findFreePort();
    const daemonPort = await findFreePort();
    const home = createIsolatedHome();
    await startStudioDev({ host, home, webPort, daemonPort });

    const probe = await runPlaywrightProbe(`http://${host}:${webPort}/`);
    const fatalErrors = probe.errors.filter(
      (error) => !/^console:Failed to load resource: the server responded with a status of 401 \(Unauthorized\)$/u.test(error),
    );
    expect(probe.url).toMatch(/\/avatars\/catalog(?:\?.*)?$/);
    expect(fatalErrors).toEqual([]);
    expect(
      probe.errors.some((error) =>
        /ERR_CONNECTION_REFUSED|Unexpected token '<'|Unexpected end of JSON input|SyntaxError/i.test(error),
      ),
    ).toBe(false);
    expect(probe.body.trim().length).toBeGreaterThan(0);
  }, 120_000);

  test("Scenario: Given Studio product command When refreshing room and attention deep links Then the default entry returns the same SPA shell instead of 404", async () => {
    const host = "127.0.0.1";
    const webPort = await findFreePort();
    const daemonPort = await findFreePort();
    const home = createIsolatedHome();
    await startStudioDev({ host, home, webPort, daemonPort });

    const roomResponse = await fetch(`http://${host}:${webPort}/messages/room/test-room?sessionId=test-session`);
    const roomHtml = await roomResponse.text();
    expect(roomResponse.status).toBe(200);
    expectSvelteShellHtml(roomHtml);

    const attentionResponse = await fetch(`http://${host}:${webPort}/avatars/runtime/test-session/attention`);
    const attentionHtml = await attentionResponse.text();
    expect(attentionResponse.status).toBe(200);
    expectSvelteShellHtml(attentionHtml);
  }, 70_000);

  test("Scenario: Given daemon and runtime store When creating session Then subscription syncs state", async () => {
    const host = "127.0.0.1";
    const port = await findFreePort();
    const home = createIsolatedHome();
    await startManagedDaemon({ host, port, home });

    const client = createAgenterClient({
      wsUrl: `ws://${host}:${port}/trpc`,
    });
    try {
      const autoLogin = await client.trpc.auth.autoLogin.mutate();
      if (!autoLogin.ok) {
        throw new Error(`expected daemon auto login to succeed, got ${autoLogin.reason}: ${autoLogin.message}`);
      }
      client.setAuthToken(autoLogin.session.token);
      const store = createRuntimeStore(client);
      await store.connect();
      await store.createSession({
        cwd: process.cwd(),
        name: "e2e-subscription",
        autoStart: false,
      });
      await waitFor(() => store.getState().sessions.some((item) => item.name === "e2e-subscription"));
      expect(store.getState().sessions.some((item) => item.name === "e2e-subscription")).toBe(true);
      store.disconnect();
    } finally {
      client.close();
    }
  }, 90_000);
});
