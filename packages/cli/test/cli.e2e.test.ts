import { expect, test } from "bun:test";
import { createServer } from "node:net";
import { resolve } from "node:path";

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

test("daemon command starts server and doctor succeeds", async () => {
  const host = "127.0.0.1";
  const port = await findFreePort();
  const daemon = spawnCli("daemon", "--host", host, "--port", String(port));

  const healthy = await waitForHealth(host, port);
  if (!healthy) {
    daemon.kill();
    const stderr = await readText(daemon.stderr);
    throw new Error(`daemon failed to become healthy: ${stderr}`);
  }

  const doctor = spawnCli("doctor", "--host", host, "--port", String(port));
  const doctorCode = await doctor.exited;
  const doctorStdout = await readText(doctor.stdout);

  expect(doctorCode).toBe(0);
  expect(doctorStdout.includes("healthy")).toBe(true);

  daemon.kill();
  await daemon.exited;
});

test("web command serves webui html", async () => {
  const host = "127.0.0.1";
  const port = await findFreePort();
  const daemon = spawnCli("web", "--host", host, "--port", String(port));

  const healthy = await waitForHealth(host, port);
  if (!healthy) {
    daemon.kill();
    const stderr = await readText(daemon.stderr);
    throw new Error(`web daemon failed to become healthy: ${stderr}`);
  }

  const html = await fetch(`http://${host}:${port}/`).then((response) => response.text());
  expect(html.includes("Agenter WebUI")).toBe(true);

  daemon.kill();
  await daemon.exited;
});
