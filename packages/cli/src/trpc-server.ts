import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { AppKernel, appRouter, createTrpcContext } from "@agenter/app-server";
import { WebSocketServer } from "ws";

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
};

export interface TrpcServerOptions {
  host: string;
  port: number;
  globalSessionRoot?: string;
  workspacesPath?: string;
  workspaceCwd?: string;
  staticDir?: string;
}

export interface TrpcServerHandle {
  host: string;
  port: number;
  stop: () => Promise<void>;
}

const sendJson = (res: ServerResponse, statusCode: number, body: Record<string, unknown>): void => {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
};

const serveStatic = (req: IncomingMessage, res: ServerResponse, staticDir: string): void => {
  const reqPath = req.url ? new URL(req.url, "http://localhost").pathname : "/";
  const safePath = normalize(reqPath).replace(/^\.\.+/, "");
  const filePath = safePath === "/" ? join(staticDir, "index.html") : join(staticDir, safePath);
  const resolvedPath = resolve(filePath);
  if (!resolvedPath.startsWith(resolve(staticDir))) {
    res.statusCode = 403;
    res.end("forbidden");
    return;
  }

  let targetPath = resolvedPath;
  if (!existsSync(targetPath)) {
    targetPath = join(staticDir, "index.html");
  }

  if (!existsSync(targetPath)) {
    res.statusCode = 404;
    res.end("web assets not found");
    return;
  }

  const ext = extname(targetPath);
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  res.setHeader("content-type", contentType);
  createReadStream(targetPath).pipe(res);
};

export const startTrpcServer = async (options: TrpcServerOptions): Promise<TrpcServerHandle> => {
  const kernel = new AppKernel({
    globalSessionRoot: options.globalSessionRoot,
    workspacesPath: options.workspacesPath,
    initialWorkspace: options.workspaceCwd,
  });
  await kernel.start();

  const trpcHandler = createHTTPHandler({
    router: appRouter,
    createContext: () => createTrpcContext(kernel),
  });

  const server = createServer((req, res) => {
    const url = req.url ? new URL(req.url, `http://${options.host}:${options.port}`) : null;
    const pathname = url?.pathname ?? "/";

    if (pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        port: (server.address() as { port?: number } | null)?.port ?? options.port,
      });
      return;
    }

    if (pathname.startsWith("/trpc")) {
      trpcHandler(req, res);
      return;
    }

    if (options.staticDir) {
      serveStatic(req, res, options.staticDir);
      return;
    }

    sendJson(res, 404, {
      ok: false,
      error: "not found",
    });
  });

  const wss = new WebSocketServer({ noServer: true });
  const wsHandler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: () => createTrpcContext(kernel),
  });

  server.on("upgrade", (req, socket, head) => {
    const pathname = req.url ? new URL(req.url, `http://${options.host}:${options.port}`).pathname : "";
    if (!pathname.startsWith("/trpc")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(options.port, options.host, () => {
      resolveReady();
    });
  });

  const actualPort = (server.address() as { port?: number } | null)?.port ?? options.port;

  return {
    host: options.host,
    port: actualPort,
    stop: async () => {
      wsHandler.broadcastReconnectNotification();
      wss.close();
      await kernel.stop();
      await new Promise<void>((resolveStop, rejectStop) => {
        server.close((error) => {
          if (error) {
            rejectStop(error);
            return;
          }
          resolveStop();
        });
      });
    },
  };
};

export const assertStaticDir = (staticDir: string): void => {
  const indexPath = join(staticDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(
      `webui assets not found at ${staticDir}. run \`bun run --filter '@agenter/webui' build\` then copy dist to cli assets.`,
    );
  }
};

export const readStaticIndexTitle = (staticDir: string): string | null => {
  const indexPath = join(staticDir, "index.html");
  if (!existsSync(indexPath)) {
    return null;
  }
  const html = readFileSync(indexPath, "utf8");
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1] : null;
};
