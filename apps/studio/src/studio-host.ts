import { createReadStream, existsSync } from "node:fs";
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, resolve } from "node:path";
import { request as httpsRequest } from "node:https";
import type { AddressInfo } from "node:net";

import { resolveStudioEntryDocumentPath } from "./static-root";

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
};

export interface StudioHostInput {
  webHost: string;
  port: number;
  staticDir: string;
  daemonEndpoint: string;
  publicEnv?: Record<string, string>;
}

export interface StudioHostHandle {
  host: string;
  port: number;
  url: string;
  stop(): Promise<void>;
}

const sendJson = (res: ServerResponse, statusCode: number, body: Record<string, unknown>): void => {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
};

const serveStatic = (req: IncomingMessage, res: ServerResponse, staticDir: string, publicEnv?: Record<string, string>): void => {
  const reqPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
  if (reqPath === "/_app/env.js" && publicEnv) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/javascript; charset=utf-8");
    res.end(`export const env=${JSON.stringify(publicEnv)}\n`);
    return;
  }
  const safePath = reqPath.replace(/^\/+/u, "");
  const entryDocumentPath = resolveStudioEntryDocumentPath(staticDir);
  const filePath = reqPath === "/" ? (entryDocumentPath ?? join(staticDir, "index.html")) : join(staticDir, safePath);
  const resolvedPath = resolve(filePath);
  if (!resolvedPath.startsWith(resolve(staticDir))) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  let targetPath = resolvedPath;
  if (!existsSync(targetPath)) {
    const fallback200 = join(staticDir, "200.html");
    targetPath = existsSync(fallback200) ? fallback200 : (entryDocumentPath ?? join(staticDir, "index.html"));
  }
  if (!targetPath || !existsSync(targetPath)) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  res.statusCode = 200;
  res.setHeader("content-type", MIME_BY_EXT[extname(targetPath)] ?? "application/octet-stream");
  createReadStream(targetPath).pipe(res);
};

const proxyHttpRequest = (req: IncomingMessage, res: ServerResponse, daemonEndpoint: string): void => {
  const target = new URL(req.url ?? "/", daemonEndpoint);
  const request = target.protocol === "https:" ? httpsRequest : httpRequest;
  const headers = { ...req.headers };
  headers.host = target.host;
  const proxy = request(
    target,
    {
      method: req.method,
      headers,
    },
    (proxyResponse) => {
      res.statusCode = proxyResponse.statusCode ?? 502;
      for (const [key, value] of Object.entries(proxyResponse.headers)) {
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      }
      proxyResponse.pipe(res);
    },
  );
  proxy.on("error", (error) => {
    if (!res.headersSent) {
      sendJson(res, 502, { error: error.message });
      return;
    }
    res.end();
  });
  req.pipe(proxy);
};

export const startStudioHost = async (input: StudioHostInput): Promise<StudioHostHandle> => {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", `http://${input.webHost}:${input.port}`).pathname;
    if (pathname === "/health") {
      sendJson(res, 200, { ok: true, app: "studio" });
      return;
    }
    if (pathname === "/trpc" || pathname.startsWith("/trpc/") || pathname.startsWith("/api/") || pathname.startsWith("/media/")) {
      proxyHttpRequest(req, res, input.daemonEndpoint);
      return;
    }
    serveStatic(req, res, input.staticDir, input.publicEnv);
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(input.port, input.webHost, () => {
      server.off("error", rejectReady);
      resolveReady();
    });
  });
  const address = server.address() as AddressInfo;
  return {
    host: input.webHost,
    port: address.port,
    url: `http://${input.webHost}:${address.port}`,
    stop: async () => {
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
