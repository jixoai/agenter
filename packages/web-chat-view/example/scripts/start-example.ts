#!/usr/bin/env bun
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

type ReviewBootstrapProfile = {
  id: string;
  name: string;
  transportUrl: string;
  accessToken: string;
  viewerContactId: string;
};

type ReviewBootstrapPayload = {
  profiles: ReviewBootstrapProfile[];
  recommendedProfileId: string | null;
};

const HOST = "127.0.0.1";
const DEFAULT_EXAMPLE_PORT = Number(process.env.WEB_CHAT_VIEW_EXAMPLE_PORT?.trim() || "4292");
const DEFAULT_HARNESS_PORT = Number(process.env.WEB_CHAT_VIEW_REVIEW_HARNESS_PORT?.trim() || "4600");
const DEFAULT_WS_PORT = Number(process.env.WEB_CHAT_VIEW_REVIEW_WS_PORT?.trim() || "4601");
const APP_ROOT = import.meta.dirname.replace(/\/scripts$/u, "");

const parsePort = (value: number, name: string): number => {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`invalid ${name}: ${value}`);
  }
  return value;
};

const isPortAvailable = async (port: number): Promise<boolean> => {
  return await new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => {
      resolve(false);
    });
    server.listen(port, HOST, () => {
      server.close(() => resolve(true));
    });
  });
};

const pickAvailablePort = async (preferred: number): Promise<number> => {
  const normalized = parsePort(preferred, "port");
  for (let port = normalized; port < normalized + 100; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`unable to find an open port near ${normalized}`);
};

const waitForJson = async <T>(url: string, attempts = 60): Promise<T> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as T;
      }
    } catch {
      // wait for the child process to come online
    }
    await Bun.sleep(250);
  }
  throw new Error(`timed out waiting for ${url}`);
};

const waitForText = async (url: string, attempts = 60): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await response.text();
        return;
      }
    } catch {
      // wait for the child process to come online
    }
    await Bun.sleep(250);
  }
  throw new Error(`timed out waiting for ${url}`);
};

const spawnProcess = (
  command: string,
  args: string[],
  env: Record<string, string>,
): ChildProcess => {
  return spawn(command, args, {
    cwd: APP_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });
};

const buildReviewUrl = (examplePort: number, profile: ReviewBootstrapProfile): string => {
  const url = new URL(`http://${HOST}:${examplePort}/`);
  url.searchParams.set("url", profile.transportUrl);
  url.searchParams.set("token", profile.accessToken);
  url.searchParams.set("viewer", profile.viewerContactId);
  url.searchParams.set("name", profile.name);
  return url.toString();
};

const selectRecommendedProfile = (bootstrap: ReviewBootstrapPayload): ReviewBootstrapProfile | null => {
  if (bootstrap.recommendedProfileId) {
    const matched = bootstrap.profiles.find((profile) => profile.id === bootstrap.recommendedProfileId);
    if (matched) {
      return matched;
    }
  }
  return bootstrap.profiles[0] ?? null;
};

const shutdownChildren = (children: readonly ChildProcess[], signal: NodeJS.Signals): void => {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

const main = async (): Promise<void> => {
  const harnessPort = await pickAvailablePort(DEFAULT_HARNESS_PORT);
  const wsPort = harnessPort === DEFAULT_HARNESS_PORT ? await pickAvailablePort(DEFAULT_WS_PORT) : await pickAvailablePort(harnessPort + 1);
  const examplePort = await pickAvailablePort(DEFAULT_EXAMPLE_PORT);

  const sharedEnv = {
    WEB_CHAT_VIEW_REVIEW_HARNESS_PORT: String(harnessPort),
    WEB_CHAT_VIEW_REVIEW_WS_PORT: String(wsPort),
  };

  const harness = spawnProcess("bun", ["run", "./scripts/review-harness.ts"], sharedEnv);
  const example = spawnProcess(
    "bun",
    ["run", "vite", "dev", "--host", HOST, "--port", String(examplePort)],
    {
      ...sharedEnv,
      PUBLIC_WEB_CHAT_VIEW_REVIEW_API_URL: `http://${HOST}:${harnessPort}`,
    },
  );
  const children = [harness, example] as const;

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    shutdownChildren(children, signal);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  for (const child of children) {
    child.once("exit", (code, signal) => {
      if (!shuttingDown) {
        shutdown(signal ?? "SIGTERM");
      }
      if (code && code !== 0) {
        process.exitCode = code;
      }
    });
  }

  const bootstrapUrl = `http://${HOST}:${harnessPort}/api/review/bootstrap`;
  await waitForJson<{ ok: true }>(`http://${HOST}:${harnessPort}/health`);
  await waitForText(`http://${HOST}:${examplePort}/`);
  const bootstrap = await waitForJson<ReviewBootstrapPayload>(bootstrapUrl);
  const recommendedProfile = selectRecommendedProfile(bootstrap);

  console.log("");
  console.log("web-chat-view example ready");
  console.log(`- review harness: http://${HOST}:${harnessPort}`);
  console.log(`- room websocket: ws://${HOST}:${wsPort}`);
  console.log(`- example root: http://${HOST}:${examplePort}/`);
  if (recommendedProfile) {
    console.log(`- review url: ${buildReviewUrl(examplePort, recommendedProfile)}`);
  }
};

await main();
