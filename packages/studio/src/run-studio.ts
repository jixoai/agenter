import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";

import { parseStudioArgs } from "./argv";
import { resolveStudioStaticRoot } from "./static-root";
import { startStudioHost, type StudioHostHandle } from "./studio-host";

const BUN_BIN = Bun.which("bun") ?? process.execPath;
const DEFAULT_WEB_CHAT_APP_VIEW_PORT = Number(process.env.WEB_CHAT_VIEW_APP_VIEW_PORT?.trim() || "4292");

const waitForSignal = async (cleanup?: () => Promise<void> | void): Promise<void> => {
  await new Promise<void>((resolve) => {
    const onSignal = async (): Promise<void> => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      try {
        await cleanup?.();
      } finally {
        resolve();
      }
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });
};

const isHttpHealthAlive = async (urlString: string): Promise<boolean> => {
  const url = new URL(urlString);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return await new Promise<boolean>((resolve) => {
    const req = request(
      url,
      {
        method: "GET",
        timeout: 5_000,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 300);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
};

const waitForHttpServer = async (url: string, timeoutMs = 30_000): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isHttpHealthAlive(url)) {
      return;
    }
    await Bun.sleep(200);
  }
  throw new Error(`studio web server did not become ready: ${url}`);
};

const isPortAvailable = async (host: string, port: number): Promise<boolean> => {
  return await new Promise<boolean>((resolve) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
};

const pickAvailablePort = async (host: string, preferred: number): Promise<number> => {
  for (let port = preferred; port < preferred + 100; port += 1) {
    if (await isPortAvailable(host, port)) {
      return port;
    }
  }
  throw new Error(`unable to find an open web-chat app-view port near ${preferred}`);
};

const daemonEndpoint = (host: string, port: number): string => `http://${host}:${port}`;
const daemonWsEndpoint = (host: string, port: number): string => `ws://${host}:${port}/trpc`;

const startStudioDevServer = async (input: {
  webHost: string;
  webPort: number;
  daemonHost: string;
  daemonPort: number;
  appViewUrl: string;
}): Promise<Bun.Subprocess<"ignore", "inherit", "inherit">> => {
  const proc = Bun.spawn({
    cmd: [BUN_BIN, "run", "dev", "--host", input.webHost, "--port", String(input.webPort)],
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      AGENTER_DAEMON_PORT: String(input.daemonPort),
      PUBLIC_AGENTER_WS_URL: daemonWsEndpoint(input.daemonHost, input.daemonPort),
      PUBLIC_WEB_CHAT_VIEW_APP_VIEW_URL: input.appViewUrl,
    },
  });
  await waitForHttpServer(`http://${input.webHost}:${input.webPort}`);
  return proc;
};

const startWebChatAppViewDevServer = async (input: {
  webHost: string;
  daemonHost: string;
  daemonPort: number;
}): Promise<{ proc: Bun.Subprocess<"ignore", "inherit", "inherit">; url: string }> => {
  const port = await pickAvailablePort(input.webHost, DEFAULT_WEB_CHAT_APP_VIEW_PORT);
  const url = `http://${input.webHost}:${port}`;
  const proc = Bun.spawn({
    cmd: [BUN_BIN, "run", "dev", "--host", input.webHost, "--port", String(port), "--strictPort"],
    cwd: fileURLToPath(new URL("../../web-chat-view/example/", import.meta.url)),
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      PUBLIC_WEB_CHAT_VIEW_REVIEW_API_URL: daemonEndpoint(input.daemonHost, input.daemonPort),
    },
  });
  await waitForHttpServer(url);
  return { proc, url };
};

export const runStudio = async (argvInput = process.argv): Promise<void> => {
  const args = parseStudioArgs(argvInput);
  let host: StudioHostHandle | null = null;
  let devServer: Bun.Subprocess<"ignore", "inherit", "inherit"> | null = null;
  let appViewDevServer: Bun.Subprocess<"ignore", "inherit", "inherit"> | null = null;
  try {
    if (args.dev) {
      const appView = await startWebChatAppViewDevServer(args);
      appViewDevServer = appView.proc;
      devServer = await startStudioDevServer({
        ...args,
        appViewUrl: appView.url,
      });
      console.log(`agenter studio (dev) api: ${daemonEndpoint(args.daemonHost, args.daemonPort)}`);
      console.log(`agenter studio (dev) ui:  http://${args.webHost}:${args.webPort}`);
      console.log(`agenter studio (dev) web-chat app-view: ${appView.url}`);
      await waitForSignal(() => {
        devServer?.kill();
        appViewDevServer?.kill();
      });
      return;
    }

    host = await startStudioHost({
      webHost: args.webHost,
      port: args.webPort,
      staticDir: resolveStudioStaticRoot().staticDir,
      daemonEndpoint: daemonEndpoint(args.daemonHost, args.daemonPort),
      publicEnv: {
        PUBLIC_AGENTER_WS_URL: daemonWsEndpoint(args.daemonHost, args.daemonPort),
        ...(process.env.PUBLIC_WEB_CHAT_VIEW_APP_VIEW_URL
          ? { PUBLIC_WEB_CHAT_VIEW_APP_VIEW_URL: process.env.PUBLIC_WEB_CHAT_VIEW_APP_VIEW_URL }
          : {}),
      },
    });
    console.log(`agenter studio listening on ${host.url}`);
    await waitForSignal(async () => {
      await host?.stop();
    });
  } finally {
    devServer?.kill();
    appViewDevServer?.kill();
    await host?.stop();
  }
};
