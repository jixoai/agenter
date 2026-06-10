import { createReadStream, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { extname, join, normalize, resolve } from "node:path";
import { Readable, type Duplex } from "node:stream";

import { AppKernel, appRouter, createTrpcContext, readBearerToken, type AppKernelOptions } from "@agenter/app-server";
import type { MessageAttachment, MessageContactId } from "@agenter/message-system";
import { z } from "zod";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer, type WebSocket } from "ws";
import {
  clearOwnedDaemonRuntimeDescriptor,
  type DaemonLauncherIdentity,
  writeDaemonRuntimeDescriptor,
} from "./daemon-runtime-descriptor";

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
const MEDIA_AUTH_TOKEN_QUERY_KEY = "authToken";
const STATIC_ENTRY_FILENAMES = ["index.html", "200.html"] as const;

export interface TrpcServerOptions {
  host: string;
  port: number;
  globalSessionRoot?: string;
  workspacesPath?: string;
  workspaceCwd?: string;
  staticDir?: string;
  publicEnv?: Record<string, string>;
  homeDir?: string;
  launcherIdentity: DaemonLauncherIdentity;
  authService?: AppKernelOptions["authService"];
  /** @deprecated Use authService. */
  profileService?: AppKernelOptions["profileService"];
}

export interface TrpcServerHandle {
  host: string;
  port: number;
  kernel: AppKernel;
  stop: () => Promise<void>;
}

const sendJson = (res: ServerResponse, statusCode: number, body: Record<string, unknown>): void => {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}
`);
};

const sendHtml = (res: ServerResponse, statusCode: number, html: string): void => {
  res.statusCode = statusCode;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
};

const sendMcpAppHtml = (res: ServerResponse, statusCode: number, html: string): void => {
  res.statusCode = statusCode;
  res.setHeader("content-type", "text/html;profile=mcp-app; charset=utf-8");
  res.end(html);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const buildMcpAppSandboxCsp = (input: unknown): string => {
  const csp = isRecord(input) ? input : {};
  const connectDomains = readStringArray(csp.connectDomains).join(" ");
  const resourceDomains = readStringArray(csp.resourceDomains).join(" ");
  const frameDomains = readStringArray(csp.frameDomains).join(" ");
  const baseUriDomains = readStringArray(csp.baseUriDomains).join(" ");
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline' blob: ${resourceDomains}`.trim(),
    `style-src 'self' 'unsafe-inline' blob: data: ${resourceDomains}`.trim(),
    `img-src 'self' data: blob: ${resourceDomains}`.trim(),
    `font-src 'self' data: blob: ${resourceDomains}`.trim(),
    `media-src 'self' data: blob: ${resourceDomains}`.trim(),
    `connect-src 'self' ${connectDomains}`.trim(),
    `worker-src 'self' blob: ${resourceDomains}`.trim(),
    frameDomains ? `frame-src ${frameDomains}` : "frame-src 'none'",
    "object-src 'none'",
    baseUriDomains ? `base-uri ${baseUriDomains}` : "base-uri 'none'",
  ].join("; ");
};

const renderMcpAppHostHtml = (): string => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body, #root, iframe { width: 100%; height: 100%; margin: 0; }
      body { background: Canvas; color: CanvasText; overflow: hidden; }
      iframe { display: block; border: 0; }
      .status { position: fixed; inset: 0; display: grid; place-items: center; font: 12px system-ui, sans-serif; color: color-mix(in srgb, currentColor 62%, transparent); }
      .status[hidden] { display: none; }
    </style>
  </head>
  <body>
    <div id="root">
      <div id="status" class="status">Connecting MCP App...</div>
      <iframe id="sandbox" title="MCP App sandbox"></iframe>
    </div>
    <script>
      const statusEl = document.getElementById("status");
      const sandbox = document.getElementById("sandbox");
      let sandboxLoaded = false;
      const wsUrl = new URL(window.location.href);
      wsUrl.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl.pathname = wsUrl.pathname.replace(/\\/host$/, "/ws");
      const ws = new WebSocket(wsUrl);
      const setStatus = (text) => {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.hidden = !text;
      };
      const loadSandbox = (resource) => {
        if (sandboxLoaded) return;
        sandboxLoaded = true;
        const sandboxUrl = new URL(window.location.href);
        sandboxUrl.pathname = sandboxUrl.pathname.replace(/\\/host$/, "/sandbox");
        sandboxUrl.searchParams.delete("csp");
        sandbox.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-modals allow-downloads");
        sandbox.src = sandboxUrl.toString();
      };
      window.addEventListener("message", (event) => {
        if (event.source !== sandbox.contentWindow) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        try {
          ws.send(JSON.stringify(event.data));
        } catch (error) {
          console.error("[MCP App Host] failed to forward app message", error);
        }
      });
      ws.addEventListener("open", () => setStatus("Loading MCP App..."));
      ws.addEventListener("message", (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch (error) {
          console.error("[MCP App Host] invalid ws payload", error);
          return;
        }
        if (payload.type === "resource") {
          loadSandbox(payload.resource);
          return;
        }
        if (payload.type === "snapshot") {
          if (payload.session?.state === "closed" || payload.session?.state === "failed") {
            setStatus(payload.session?.error || "MCP App closed");
          }
          return;
        }
        if (payload.type === "message" && sandbox.contentWindow) {
          setStatus("");
          sandbox.contentWindow.postMessage(payload.message, "*");
        }
      });
      ws.addEventListener("close", () => setStatus("MCP App disconnected"));
      ws.addEventListener("error", () => setStatus("MCP App connection error"));
      window.addEventListener("beforeunload", () => ws.close());
    </script>
  </body>
</html>`;

const resolveStaticEntryDocumentPath = (staticDir: string): string | null => {
  for (const filename of STATIC_ENTRY_FILENAMES) {
    const filePath = join(staticDir, filename);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
};

const normalizeHost = (value: string): string => value.replace(/^\[(.*)\]$/u, "$1").toLowerCase();

const isLoopbackHost = (value: string): boolean => {
  const normalized = normalizeHost(value);
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
};

const resolveAllowedOrigin = (input: { requestOriginHeader: string | undefined; host: string }): string | null => {
  const originHeader = input.requestOriginHeader?.trim();
  if (!originHeader) {
    return null;
  }
  let originUrl: URL;
  try {
    originUrl = new URL(originHeader);
  } catch {
    return null;
  }
  const originHost = normalizeHost(originUrl.hostname);
  const serverHost = normalizeHost(input.host);
  if (originHost === serverHost) {
    return originUrl.origin;
  }
  if (isLoopbackHost(originHost) && isLoopbackHost(serverHost)) {
    return originUrl.origin;
  }
  return null;
};

const setCors = (res: ServerResponse, allowOrigin: string | null): void => {
  if (!allowOrigin) {
    return;
  }
  res.setHeader("access-control-allow-origin", allowOrigin);
  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,x-agenter-room-access-token");
};

type RequestInitWithDuplex = RequestInit & { duplex: "half" };
type FileUpload = { name: string; mimeType: string; bytes: Uint8Array };

const isFileValue = (value: FormDataEntryValue): value is File => value instanceof File;

const toWebRequest = (req: IncomingMessage, origin: string): Request => {
  const url = new URL(req.url ?? "/", origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }
    headers.set(key, value);
  }
  const init: RequestInitWithDuplex = {
    method: req.method,
    headers,
    duplex: "half",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req) as unknown as NonNullable<RequestInit["body"]>;
  }
  return new Request(url, init);
};

const decodePathMatch = (pathname: string, pattern: RegExp): string[] | null => {
  const match = pathname.match(pattern);
  return match ? match.slice(1).map((value) => decodeURIComponent(value)) : null;
};

const readRequestHeader = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const resolveRequestWsProtocol = (req: IncomingMessage): "ws:" | "wss:" => {
  const forwardedProto = readRequestHeader(req.headers["x-forwarded-proto"])?.toLowerCase();
  return forwardedProto === "https" ? "wss:" : "ws:";
};

const resolveRequestHost = (req: IncomingMessage, fallback: string): string =>
  readRequestHeader(req.headers.host)?.trim() || fallback;

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
};

const isBatchedTrpcHttpRequest = (url: URL | null): boolean => url?.searchParams.has("batch") ?? false;

const managedSeatEndpointSchema = z
  .object({
    authorityUrl: z.string().trim().url(),
    trpcPath: z.string().trim().min(1).optional(),
    acceptPath: z.string().trim().min(1).optional(),
  })
  .strict();

const terminalInviteBodySchema = z
  .object({
    terminalId: z.string().trim().min(1),
    participantId: z.string().trim().min(1),
    seatClass: z.enum(["RO", "RW", "TM"]),
    label: z.string().trim().min(1).optional(),
    expiresAt: z.number().int().positive().optional(),
    accessToken: z.string().trim().min(1).optional(),
    actorId: z.string().trim().min(1).optional(),
    superadminActorId: z.string().trim().min(1).optional(),
    endpoint: managedSeatEndpointSchema.optional(),
  })
  .strict();

const terminalPrepareAcceptBodySchema = z
  .object({
    descriptor: z.string().trim().min(1),
  })
  .strict();

const terminalAcceptBodySchema = z
  .object({
    descriptor: z.string().trim().min(1),
    proof: z
      .object({
        inviteePrincipalId: z.string().trim().min(1),
        payload: z.string().min(1),
        signature: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

const terminalConfigBodySchema = z
  .object({
    terminalId: z.string().trim().min(1),
    participantId: z.string().trim().min(1),
    seatClass: z.enum(["RO", "RW", "TM"]),
    label: z.string().trim().min(1).optional(),
    expiresAt: z.number().int().positive().optional(),
    accessToken: z.string().trim().min(1).optional(),
    actorId: z.string().trim().min(1).optional(),
    superadminActorId: z.string().trim().min(1).optional(),
    endpoint: managedSeatEndpointSchema.optional(),
  })
  .strict();

const terminalRevokeBodySchema = z
  .object({
    terminalId: z.string().trim().min(1),
    participantId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1).optional(),
    actorId: z.string().trim().min(1).optional(),
    superadminActorId: z.string().trim().min(1).optional(),
  })
  .strict();

const messageInviteBodySchema = z
  .object({
    chatId: z.string().trim().min(1),
    participantId: z.string().trim().min(1),
    seatClass: z.enum(["readonly", "member", "admin"]),
    label: z.string().trim().min(1).optional(),
    expiresAt: z.number().int().positive().optional(),
    accessToken: z.string().trim().min(1).optional(),
    superadminContactId: z.string().trim().min(1).optional(),
    endpoint: managedSeatEndpointSchema.optional(),
  })
  .strict();

const messagePrepareAcceptBodySchema = z
  .object({
    descriptor: z.string().trim().min(1),
  })
  .strict();

const messageAcceptBodySchema = z
  .object({
    descriptor: z.string().trim().min(1),
    proof: z
      .object({
        inviteePrincipalId: z.string().trim().min(1),
        payload: z.string().min(1),
        signature: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

const messageConfigBodySchema = z
  .object({
    chatId: z.string().trim().min(1),
    participantId: z.string().trim().min(1),
    seatClass: z.enum(["readonly", "member", "admin"]),
    label: z.string().trim().min(1).optional(),
    expiresAt: z.number().int().positive().optional(),
    accessToken: z.string().trim().min(1).optional(),
    superadminContactId: z.string().trim().min(1).optional(),
    endpoint: managedSeatEndpointSchema.optional(),
  })
  .strict();

const messageRevokeBodySchema = z
  .object({
    chatId: z.string().trim().min(1),
    participantId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1).optional(),
    superadminContactId: z.string().trim().min(1).optional(),
  })
  .strict();

const roomSnapshotBodySchema = z
  .object({
    chatId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
    limit: z.number().int().positive().max(500).optional(),
  })
  .strict();

const roomSendBodySchema = z
  .object({
    chatId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
    text: z.string().min(1),
    senderContactId: z.string().trim().min(1).optional(),
    attachments: z.array(z.custom<MessageAttachment>((value) => {
      if (!value || typeof value !== "object") {
        return false;
      }
      const candidate = value as Partial<MessageAttachment>;
      return (
        typeof candidate.assetId === "string" &&
        (candidate.kind === "image" || candidate.kind === "video" || candidate.kind === "file") &&
        typeof candidate.name === "string" &&
        typeof candidate.mimeType === "string" &&
        typeof candidate.sizeBytes === "number" &&
        typeof candidate.url === "string"
      );
    })).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const roomMessageBodySchema = z
  .object({
    content: z.string().default(""),
    from: z.string().trim().min(1).optional(),
    kind: z.literal("text").optional(),
    ref: z.number().int().positive().optional(),
    senderContactId: z.string().trim().min(1).optional(),
    attachments: roomSendBodySchema.shape.attachments,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const roomMarkReadBodySchema = z
  .object({
    chatId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
    messageId: z.number().int().positive(),
  })
  .strict();

const roomEditBodySchema = z
  .object({
    chatId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
    messageId: z.number().int().positive(),
    text: z.string().min(1),
  })
  .strict();

const roomRecallBodySchema = z
  .object({
    chatId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
    messageId: z.number().int().positive(),
  })
  .strict();

const terminalReadBodySchema = z
  .object({
    terminalId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
    mode: z.enum(["auto", "diff", "snapshot"]).optional(),
    recordActivity: z.boolean().optional(),
    remark: z.boolean().optional(),
  })
  .strict();

const terminalWriteBodySchema = z
  .object({
    terminalId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
    text: z.string(),
    readMode: z.enum(["auto", "diff", "snapshot"]).optional(),
    readRecordActivity: z.boolean().optional(),
    returnRead: z
      .union([
        z.boolean(),
        z
          .object({
            throttleMs: z.number().int().nonnegative().optional(),
            debounceMs: z.number().int().nonnegative().optional(),
          })
          .strict(),
      ])
      .optional(),
  })
  .strict();

const notePageHttpQuerySchema = z
  .object({
    avatarNickname: z.string().trim().min(1).optional(),
    notebook: z.string().trim().min(1),
    section: z.string().trim().min(1),
    page: z.string().trim().min(1),
  })
  .strict();

const readRequestAuthToken = (req: IncomingMessage, url: URL): string | null => {
  const headerToken = readBearerToken(readRequestHeader(req.headers.authorization));
  if (headerToken) {
    return headerToken;
  }
  const queryToken = url.searchParams.get(MEDIA_AUTH_TOKEN_QUERY_KEY)?.trim();
  return queryToken && queryToken.length > 0 ? queryToken : null;
};

const authenticateBrowserAuth = async (
  kernel: AppKernel,
  req: IncomingMessage,
  url: URL,
): Promise<Awaited<ReturnType<AppKernel["authenticateAuthToken"]>>> => {
  return await kernel.authenticateAuthToken(readRequestAuthToken(req, url));
};

const requireBrowserAuth = async (
  kernel: AppKernel,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<Awaited<ReturnType<AppKernel["authenticateAuthToken"]>> | null> => {
  const auth = await authenticateBrowserAuth(kernel, req, url);
  if (!auth) {
    sendJson(res, 401, { ok: false, error: "auth token required" });
    return null;
  }
  return auth;
};

const requireBrowserSuperadmin = async (
  kernel: AppKernel,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<Awaited<ReturnType<AppKernel["authenticateAuthToken"]>> | null> => {
  const auth = await requireBrowserAuth(kernel, req, res, url);
  if (!auth) {
    return null;
  }
  if (!auth.claims.superadmin) {
    sendJson(res, 403, { ok: false, error: "superadmin auth required" });
    return null;
  }
  return auth;
};

const withUtf8Charset = (mimeType: string): string => {
  const normalized = mimeType.trim().toLowerCase();
  if (
    normalized.startsWith("text/") ||
    normalized === "application/json" ||
    normalized === "application/yaml" ||
    normalized.endsWith("+json") ||
    normalized.endsWith("+xml")
  ) {
    return `${normalized}; charset=utf-8`;
  }
  return normalized || "application/octet-stream";
};

const serveRuntimePublicEnv = (res: ServerResponse, publicEnv: Record<string, string>): void => {
  res.statusCode = 200;
  res.setHeader("content-type", "text/javascript; charset=utf-8");
  res.end(`export const env=${JSON.stringify(publicEnv)}\n`);
};

const serveStatic = (req: IncomingMessage, res: ServerResponse, staticDir: string, publicEnv?: Record<string, string>): void => {
  const reqPath = req.url ? new URL(req.url, "http://localhost").pathname : "/";
  if (reqPath === "/_app/env.js" && publicEnv) {
    serveRuntimePublicEnv(res, publicEnv);
    return;
  }
  const safePath = normalize(reqPath).replace(/^\.\.+/, "");
  const entryDocumentPath = resolveStaticEntryDocumentPath(staticDir);
  const filePath = safePath === "/" ? (entryDocumentPath ?? join(staticDir, "index.html")) : join(staticDir, safePath);
  const resolvedPath = resolve(filePath);
  if (!resolvedPath.startsWith(resolve(staticDir))) {
    res.statusCode = 403;
    res.end("forbidden");
    return;
  }

  let targetPath = resolvedPath;
  if (!existsSync(targetPath)) {
    const fallback200 = join(staticDir, "200.html");
    targetPath = existsSync(fallback200) ? fallback200 : (entryDocumentPath ?? join(staticDir, "index.html"));
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

const rewriteTrpcHttpUrl = (req: IncomingMessage): (() => void) => {
  const originalUrl = req.url ?? "/";
  const parsed = new URL(originalUrl, "http://localhost");
  const nextPath = parsed.pathname.slice("/trpc".length) || "/";
  req.url = `${nextPath}${parsed.search}`;
  return () => {
    req.url = originalUrl;
  };
};

export const startTrpcServer = async (options: TrpcServerOptions): Promise<TrpcServerHandle> => {
  const kernel = new AppKernel({
    globalSessionRoot: options.globalSessionRoot,
    workspacesPath: options.workspacesPath,
    homeDir: options.homeDir,
    initialWorkspace: options.workspaceCwd,
    authService: options.authService,
    profileService: options.profileService,
  });
  await kernel.start();

  let actualPort = options.port;
  const trpcHandler = createHTTPHandler({
    router: appRouter,
    createContext: async ({ req }) =>
      await createTrpcContext({
        kernel,
        authorizationHeader: req.headers.authorization ?? null,
        resolveMcpInspectorWsUrl: ({ avatarNickname, leaseId }) => {
          const url = new URL(`${resolveRequestWsProtocol(req)}//${resolveRequestHost(req, `${options.host}:${actualPort}`)}`);
          url.pathname = `/mcp/inspector/${encodeURIComponent(leaseId)}`;
          if (avatarNickname?.trim()) {
            url.searchParams.set("avatarNickname", avatarNickname.trim());
          }
          return url.toString();
        },
        resolveMcpAppServerUrls: ({ avatarNickname, leaseId }) => {
          const hostUrl = new URL(
            `${req.headers["x-forwarded-proto"] === "https" ? "https:" : "http:"}//${resolveRequestHost(req, `${options.host}:${actualPort}`)}`,
          );
          hostUrl.pathname = `/mcp/apps/${encodeURIComponent(leaseId)}/host`;
          const wsUrl = new URL(
            `${resolveRequestWsProtocol(req)}//${resolveRequestHost(req, `${options.host}:${actualPort}`)}`,
          );
          wsUrl.pathname = `/mcp/apps/${encodeURIComponent(leaseId)}/ws`;
          if (avatarNickname?.trim()) {
            hostUrl.searchParams.set("avatarNickname", avatarNickname.trim());
            wsUrl.searchParams.set("avatarNickname", avatarNickname.trim());
          }
          return {
            hostUrl: hostUrl.toString(),
            wsUrl: wsUrl.toString(),
          };
        },
      }),
  });

  const server = createServer((req, res) => {
    const origin = `http://${options.host}:${options.port}`;
    const url = req.url ? new URL(req.url, origin) : null;
    const pathname = url?.pathname ?? "/";
    const allowedOrigin = resolveAllowedOrigin({
      requestOriginHeader: readRequestHeader(req.headers.origin) ?? undefined,
      host: options.host,
    });
    const hasOriginHeader = readRequestHeader(req.headers.origin) !== null;

    if (
      hasOriginHeader &&
      !allowedOrigin &&
      (pathname === "/health" || pathname.startsWith("/api/") || pathname.startsWith("/media/") || pathname.startsWith("/trpc"))
    ) {
      sendJson(res, 403, { ok: false, error: "origin not allowed" });
      return;
    }

    if (req.method === "OPTIONS") {
      setCors(res, allowedOrigin);
      res.statusCode = 204;
      res.end();
      return;
    }

    if (pathname === "/health") {
      setCors(res, allowedOrigin);
      sendJson(res, 200, {
        ok: true,
        port: (server.address() as { port?: number } | null)?.port ?? options.port,
        launcher: options.launcherIdentity,
      });
      return;
    }

    if (req.method === "GET" && /^\/mcp\/apps\/[^/]+\/host$/u.test(pathname)) {
      sendHtml(res, 200, renderMcpAppHostHtml());
      return;
    }

    const appSandboxMatch = decodePathMatch(pathname, /^\/mcp\/apps\/([^/]+)\/sandbox$/u);
    if (req.method === "GET" && appSandboxMatch) {
      const [leaseId] = appSandboxMatch;
      void (async () => {
        try {
          if (!leaseId) {
            sendHtml(res, 400, "mcp app-server lease id is required");
            return;
          }
          const resource = await kernel.readMcpAppServerLeaseResource({
            avatarNickname: url?.searchParams.get("avatarNickname") ?? undefined,
            leaseId,
          });
          res.setHeader("Content-Security-Policy", buildMcpAppSandboxCsp(resource.csp));
          sendMcpAppHtml(res, 200, resource.html);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendHtml(res, message.includes("lease not found") ? 404 : 500, message);
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/terminal/invite") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = terminalInviteBodySchema.parse(await readJsonBody(req));
          const invitation = kernel.inviteGlobalTerminalSeat({
            terminalId: body.terminalId,
            participantId: body.participantId,
            seatClass: body.seatClass,
            label: body.label,
            expiresAt: body.expiresAt,
            accessToken: body.accessToken,
            actorId: body.actorId as never,
            superadminActorId: body.superadminActorId as never,
            endpoint: body.endpoint,
          });
          sendJson(res, 200, { ok: true, invitation });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/terminal/prepare-accept") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = terminalPrepareAcceptBodySchema.parse(await readJsonBody(req));
          const result = kernel.prepareGlobalTerminalSeatAccept(body);
          sendJson(res, 200, { ok: true, ...result });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/terminal/accept") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = terminalAcceptBodySchema.parse(await readJsonBody(req));
          const result = await kernel.acceptGlobalTerminalSeat({
            descriptor: body.descriptor,
            proof: {
              inviteePrincipalId: body.proof.inviteePrincipalId as `0x${string}`,
              payload: body.proof.payload,
              signature: body.proof.signature as `0x${string}`,
            },
          });
          sendJson(res, 200, { ok: true, ...result });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/terminal/config") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = terminalConfigBodySchema.parse(await readJsonBody(req));
          const result = kernel.configGlobalTerminalSeat({
            terminalId: body.terminalId,
            participantId: body.participantId,
            seatClass: body.seatClass,
            label: body.label,
            expiresAt: body.expiresAt,
            accessToken: body.accessToken,
            actorId: body.actorId as never,
            superadminActorId: body.superadminActorId as never,
            endpoint: body.endpoint,
          });
          sendJson(res, 200, { ok: true, result });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/terminal/revoke") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = terminalRevokeBodySchema.parse(await readJsonBody(req));
          const result = kernel.revokeGlobalTerminalSeat({
            terminalId: body.terminalId,
            participantId: body.participantId,
            accessToken: body.accessToken,
            actorId: body.actorId as never,
            superadminActorId: body.superadminActorId as never,
          });
          sendJson(res, 200, { ok: true, result });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/message/invite") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = messageInviteBodySchema.parse(await readJsonBody(req));
          const invitation = kernel.inviteGlobalRoomSeat({
            chatId: body.chatId,
            participantId: body.participantId,
            seatClass: body.seatClass,
            label: body.label,
            expiresAt: body.expiresAt,
            accessToken: body.accessToken,
            superadminContactId: body.superadminContactId as never,
            endpoint: body.endpoint,
          });
          sendJson(res, 200, { ok: true, invitation });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/message/prepare-accept") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = messagePrepareAcceptBodySchema.parse(await readJsonBody(req));
          const result = kernel.prepareGlobalRoomSeatAccept(body);
          sendJson(res, 200, { ok: true, ...result });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/message/accept") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = messageAcceptBodySchema.parse(await readJsonBody(req));
          const result = await kernel.acceptGlobalRoomSeat({
            descriptor: body.descriptor,
            proof: {
              inviteePrincipalId: body.proof.inviteePrincipalId as `0x${string}`,
              payload: body.proof.payload,
              signature: body.proof.signature as `0x${string}`,
            },
          });
          sendJson(res, 200, { ok: true, ...result });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/message/config") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = messageConfigBodySchema.parse(await readJsonBody(req));
          const result = kernel.configGlobalRoomSeat({
            chatId: body.chatId,
            participantId: body.participantId,
            seatClass: body.seatClass,
            label: body.label,
            expiresAt: body.expiresAt,
            accessToken: body.accessToken,
            superadminContactId: body.superadminContactId as never,
            endpoint: body.endpoint,
          });
          sendJson(res, 200, { ok: true, result });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/api/managed-seats/message/revoke") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = messageRevokeBodySchema.parse(await readJsonBody(req));
          const result = kernel.revokeGlobalRoomSeat({
            chatId: body.chatId,
            participantId: body.participantId,
            accessToken: body.accessToken,
            superadminContactId: body.superadminContactId as never,
          });
          sendJson(res, 200, { ok: true, result });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/trpc/message.globalSnapshot" && !isBatchedTrpcHttpRequest(url)) {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = roomSnapshotBodySchema.parse(await readJsonBody(req));
          const snapshot = kernel.snapshotGlobalRoom({
            chatId: body.chatId,
            accessToken: body.accessToken,
            limit: body.limit,
          });
          const actorDirectory = await kernel.projectPublicRoomActorDirectory({
            snapshot,
            viewerActorId: snapshot.channel.participantId as MessageContactId | undefined,
          });
          sendJson(res, 200, { snapshot, actorDirectory });
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/trpc/message.globalSend" && !isBatchedTrpcHttpRequest(url)) {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = roomSendBodySchema.parse(await readJsonBody(req));
          const result = kernel.sendGlobalRoomMessage({
            chatId: body.chatId,
            accessToken: body.accessToken,
            text: body.text,
            attachments: body.attachments,
            metadata: body.metadata,
            actorId: body.senderContactId as MessageContactId | undefined,
          });
          sendJson(res, 200, result);
        } catch (error) {
          sendJson(res, 400, { ok: false, reason: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    const roomMessageMatch = decodePathMatch(pathname, /^\/api\/rooms\/([^/]+)\/messages$/);
    if (req.method === "POST" && roomMessageMatch) {
      setCors(res, allowedOrigin);
      const [chatId] = roomMessageMatch;
      const accessToken = readRequestHeader(req.headers["x-agenter-room-access-token"])?.trim() ?? "";
      void (async () => {
        try {
          const body = roomMessageBodySchema.parse(await readJsonBody(req));
          const content = body.content.trim();
          if (content.length === 0 && (body.attachments?.length ?? 0) === 0) {
            sendJson(res, 400, { ok: false, error: "message content or attachments required" });
            return;
          }
          const result = kernel.sendGlobalRoomMessage({
            chatId,
            accessToken,
            text: content,
            attachments: body.attachments,
            metadata: body.metadata,
            actorId: body.senderContactId as MessageContactId | undefined,
          });
          sendJson(res, result.ok ? 200 : 400, result.ok ? { ok: true } : { ok: false, error: result.reason });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/trpc/message.globalMarkRead" && !isBatchedTrpcHttpRequest(url)) {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = roomMarkReadBodySchema.parse(await readJsonBody(req));
          const channel = kernel.markGlobalRoomRead({
            chatId: body.chatId,
            accessToken: body.accessToken,
            messageId: body.messageId,
          });
          sendJson(res, 200, { channel });
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/trpc/message.globalEdit" && !isBatchedTrpcHttpRequest(url)) {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = roomEditBodySchema.parse(await readJsonBody(req));
          const result = kernel.editGlobalRoomMessage({
            chatId: body.chatId,
            accessToken: body.accessToken,
            messageId: body.messageId,
            text: body.text,
          });
          sendJson(res, 200, result);
        } catch (error) {
          sendJson(res, 400, { ok: false, reason: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/trpc/message.globalRecall" && !isBatchedTrpcHttpRequest(url)) {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = roomRecallBodySchema.parse(await readJsonBody(req));
          const result = kernel.recallGlobalRoomMessage({
            chatId: body.chatId,
            accessToken: body.accessToken,
            messageId: body.messageId,
          });
          sendJson(res, 200, result);
        } catch (error) {
          sendJson(res, 400, { ok: false, reason: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/trpc/terminal.globalRead" && !isBatchedTrpcHttpRequest(url)) {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = terminalReadBodySchema.parse(await readJsonBody(req));
          const result = await kernel.readGlobalTerminal({
            terminalId: body.terminalId,
            accessToken: body.accessToken,
            mode: body.mode,
            recordActivity: body.recordActivity,
            remark: body.remark,
          });
          sendJson(res, 200, { result });
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/trpc/terminal.globalWrite" && !isBatchedTrpcHttpRequest(url)) {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = terminalWriteBodySchema.parse(await readJsonBody(req));
          const result = await kernel.writeGlobalTerminal({
            terminalId: body.terminalId,
            accessToken: body.accessToken,
            text: body.text,
            readMode: body.readMode,
            readRecordActivity: body.readRecordActivity,
            returnRead: body.returnRead,
          });
          sendJson(res, 200, { ...result });
        } catch (error) {
          sendJson(res, 400, { ok: false, message: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && pathname === "/trpc/terminal.globalInput" && !isBatchedTrpcHttpRequest(url)) {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = terminalWriteBodySchema.parse(await readJsonBody(req));
          const result = await kernel.inputGlobalTerminal({
            terminalId: body.terminalId,
            accessToken: body.accessToken,
            text: body.text,
            readMode: body.readMode,
            readRecordActivity: body.readRecordActivity,
            returnRead: body.returnRead,
          });
          sendJson(res, 200, { ...result });
        } catch (error) {
          sendJson(res, 400, { ok: false, message: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "GET" && pathname === "/api/notes/page") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          if (!url || !(await requireBrowserSuperadmin(kernel, req, res, url))) {
            return;
          }
          const query = notePageHttpQuerySchema.parse({
            avatarNickname: url.searchParams.get("avatarNickname") ?? undefined,
            notebook: url.searchParams.get("notebook") ?? undefined,
            section: url.searchParams.get("section") ?? undefined,
            page: url.searchParams.get("page") ?? undefined,
          });
          const output = await kernel.readNotePage(query);
          if (!output.capability.available || !output.page) {
            sendJson(res, 404, { ok: false, error: "note page not found" });
            return;
          }
          const body = output.page.body;
          const bytes = Buffer.from(body, "utf8");
          res.statusCode = 200;
          res.setHeader("content-type", withUtf8Charset(output.page.metadata.mime));
          res.setHeader("content-length", String(bytes.byteLength));
          res.end(bytes);
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    const uploadMatch = decodePathMatch(pathname, /^\/api\/sessions\/([^/]+)\/assets$/);
    if (req.method === "POST" && uploadMatch) {
      setCors(res, allowedOrigin);
      const [sessionId] = uploadMatch;
      void (async () => {
        try {
          if (!url || !(await requireBrowserSuperadmin(kernel, req, res, url))) {
            return;
          }
          const request = toWebRequest(req, origin);
          const form = await request.formData();
          const files = form.getAll("files").filter(isFileValue);
          if (files.length === 0) {
            sendJson(res, 400, { ok: false, error: "asset file is required" });
            return;
          }
          const uploads: FileUpload[] = [];
          for (const file of files) {
            uploads.push({
              name: file.name || "asset",
              mimeType: file.type || "application/octet-stream",
              bytes: new Uint8Array(await file.arrayBuffer()),
            });
          }
          const items = await kernel.uploadSessionAssets(sessionId, uploads);
          sendJson(res, 200, { ok: true, items });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return;
    }

    const roomUploadMatch = decodePathMatch(pathname, /^\/api\/rooms\/([^/]+)\/assets$/);
    if (req.method === "POST" && roomUploadMatch) {
      setCors(res, allowedOrigin);
      const [chatId] = roomUploadMatch;
      const accessTokenHeader = req.headers["x-agenter-room-access-token"];
      const accessToken = Array.isArray(accessTokenHeader) ? accessTokenHeader[0] : accessTokenHeader;
      void (async () => {
        try {
          if (!url || !(await requireBrowserAuth(kernel, req, res, url))) {
            return;
          }
          const request = toWebRequest(req, origin);
          const form = await request.formData();
          const files = form.getAll("files").filter(isFileValue);
          if (files.length === 0) {
            sendJson(res, 400, { ok: false, error: "asset file is required" });
            return;
          }
          const uploads: FileUpload[] = [];
          for (const file of files) {
            uploads.push({
              name: file.name || "asset",
              mimeType: file.type || "application/octet-stream",
              bytes: new Uint8Array(await file.arrayBuffer()),
            });
          }
          const items = await kernel.uploadGlobalRoomAssets({
            chatId,
            accessToken: accessToken ?? undefined,
            files: uploads,
          });
          sendJson(res, 200, { ok: true, items });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return;
    }

    const mediaMatch = decodePathMatch(pathname, /^\/media\/sessions\/([^/]+)\/assets\/([^/]+)$/);
    if (req.method === "GET" && mediaMatch) {
      setCors(res, allowedOrigin);
      const [sessionId, assetId] = mediaMatch;
      void (async () => {
        if (!url || !(await requireBrowserSuperadmin(kernel, req, res, url))) {
          return;
        }
        const media = kernel.getSessionAsset(sessionId, assetId);
        if (!media) {
          sendJson(res, 404, { ok: false, error: "asset not found" });
          return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", media.mimeType);
        res.setHeader("content-length", String(media.sizeBytes));
        createReadStream(media.filePath).pipe(res);
      })();
      return;
    }

    const roomMediaMatch = decodePathMatch(pathname, /^\/media\/rooms\/([^/]+)\/assets\/([^/]+)$/);
    if (req.method === "GET" && roomMediaMatch) {
      setCors(res, allowedOrigin);
      const [chatId, assetId] = roomMediaMatch;
      void (async () => {
        if (!url || !(await requireBrowserAuth(kernel, req, res, url))) {
          return;
        }
        const media = kernel.getGlobalRoomAsset(chatId, assetId);
        if (!media) {
          sendJson(res, 404, { ok: false, error: "asset not found" });
          return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", media.mimeType);
        res.setHeader("content-length", String(media.sizeBytes));
        createReadStream(media.filePath).pipe(res);
      })();
      return;
    }

    if (pathname.startsWith("/trpc")) {
      setCors(res, allowedOrigin);
      const restoreUrl = rewriteTrpcHttpUrl(req);
      try {
        trpcHandler(req, res);
      } finally {
        queueMicrotask(restoreUrl);
      }
      return;
    }

    if (options.staticDir) {
      serveStatic(req, res, options.staticDir, options.publicEnv);
      return;
    }

    sendJson(res, 404, {
      ok: false,
      error: "not found",
    });
  });

  const serverSockets = new Set<Socket>();
  server.on("connection", (socket) => {
    serverSockets.add(socket);
    socket.once("close", () => {
      serverSockets.delete(socket);
    });
  });

  const wss = new WebSocketServer({ noServer: true });
  const wsHandler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: async ({ req, info }) =>
      await createTrpcContext({
        kernel,
        authorizationHeader:
          (typeof info.connectionParams?.authorization === "string" ? info.connectionParams.authorization : null) ??
          req.headers.authorization ??
          null,
      }),
  });
  const inspectorWss = new WebSocketServer({ noServer: true });
  const appServerWss = new WebSocketServer({ noServer: true });
  const upgradedSockets = new Set<Duplex>();
  inspectorWss.on("connection", (ws: WebSocket, req) => {
    const url = req.url ? new URL(req.url, `http://${options.host}:${actualPort}`) : null;
    const [leaseId] = decodePathMatch(url?.pathname ?? "", /^\/mcp\/inspector\/([^/]+)$/) ?? [];
    let releaseLease: (() => void) | null = null;
    let socketClosed = false;
    const send = (payload: unknown): void => {
      try {
        ws.send(JSON.stringify(payload));
      } catch {
        // The close handler owns lease release; failed sends are best-effort telemetry.
      }
    };
    const releaseFromSocket = (): void => {
      socketClosed = true;
      releaseLease?.();
      releaseLease = null;
    };
    ws.once("close", releaseFromSocket);
    ws.once("error", releaseFromSocket);
    if (!leaseId) {
      send({ type: "error", error: "mcp inspector lease id is required" });
      ws.close(1008, "mcp inspector lease id is required");
      return;
    }
    void kernel
      .attachMcpInspectorLease(
        {
          avatarNickname: url?.searchParams.get("avatarNickname") ?? undefined,
          leaseId,
        },
        send,
      )
      .then((release) => {
        if (socketClosed) {
          release();
          return;
        }
        releaseLease = release;
      })
      .catch((error: unknown) => {
        send({ type: "error", error: error instanceof Error ? error.message : String(error) });
        ws.close(1011, "mcp inspector lease attach failed");
      });
  });
  appServerWss.on("connection", (ws: WebSocket, req) => {
    const url = req.url ? new URL(req.url, `http://${options.host}:${actualPort}`) : null;
    const [leaseId] = decodePathMatch(url?.pathname ?? "", /^\/mcp\/apps\/([^/]+)\/ws$/u) ?? [];
    let leaseHandle: Awaited<ReturnType<AppKernel["attachMcpAppServerLease"]>> | null = null;
    let socketClosed = false;
    const send = (payload: unknown): void => {
      try {
        ws.send(JSON.stringify(payload));
      } catch {
        // The close handler owns lease release; failed sends are best-effort telemetry.
      }
    };
    const releaseFromSocket = (): void => {
      socketClosed = true;
      leaseHandle?.release();
      leaseHandle = null;
    };
    ws.once("close", releaseFromSocket);
    ws.once("error", releaseFromSocket);
    if (!leaseId) {
      send({ type: "error", error: "mcp app-server lease id is required" });
      ws.close(1008, "mcp app-server lease id is required");
      return;
    }
    void kernel
      .attachMcpAppServerLease(
        {
          avatarNickname: url?.searchParams.get("avatarNickname") ?? undefined,
          leaseId,
        },
        send,
      )
      .then((handle) => {
        if (socketClosed) {
          handle.release();
          return;
        }
        leaseHandle = handle;
      })
      .catch((error: unknown) => {
        send({ type: "error", error: error instanceof Error ? error.message : String(error) });
        ws.close(1011, "mcp app-server lease attach failed");
      });
    ws.on("message", (data) => {
      const text = typeof data === "string" ? data : data.toString("utf8");
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch (error) {
        send({ type: "error", error: error instanceof Error ? error.message : String(error) });
        return;
      }
      void leaseHandle?.receive(payload).catch((error: unknown) => {
        send({ type: "error", error: error instanceof Error ? error.message : String(error) });
      });
    });
  });

  server.on("upgrade", (req, socket, head) => {
    upgradedSockets.add(socket);
    socket.once("close", () => {
      upgradedSockets.delete(socket);
    });
    const pathname = req.url ? new URL(req.url, `http://${options.host}:${options.port}`).pathname : "";
    const allowedOrigin = resolveAllowedOrigin({
      requestOriginHeader: readRequestHeader(req.headers.origin) ?? undefined,
      host: options.host,
    });
    if (readRequestHeader(req.headers.origin) && !allowedOrigin) {
      socket.destroy();
      return;
    }
    if (pathname.startsWith("/mcp/inspector/")) {
      inspectorWss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        inspectorWss.emit("connection", ws, req);
      });
      return;
    }
    if (/^\/mcp\/apps\/[^/]+\/ws$/u.test(pathname)) {
      appServerWss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        appServerWss.emit("connection", ws, req);
      });
      return;
    }
    if (!pathname.startsWith("/trpc")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      wss.emit("connection", ws, req);
    });
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(options.port, options.host, () => {
      resolveReady();
    });
  });

  actualPort = (server.address() as { port?: number } | null)?.port ?? options.port;
  const homeDir = options.homeDir ?? process.env.HOME ?? process.cwd();
  kernel.setManagedSeatAuthorityUrl(`http://${options.host}:${actualPort}`);
  writeDaemonRuntimeDescriptor({
    pid: process.pid,
    host: options.host,
    port: actualPort,
    endpoint: `http://${options.host}:${actualPort}`,
    homeDir,
    launcher: options.launcherIdentity,
    updatedAt: new Date().toISOString(),
  });

  return {
    host: options.host,
    port: actualPort,
    kernel,
    stop: async () => {
      wsHandler.broadcastReconnectNotification();
      for (const ws of inspectorWss.clients) {
        ws.terminate();
      }
      for (const ws of appServerWss.clients) {
        ws.terminate();
      }
      for (const socket of upgradedSockets) {
        socket.destroy();
      }
      for (const socket of serverSockets) {
        socket.destroy();
      }
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      inspectorWss.close();
      appServerWss.close();
      wss.close();
      await kernel.stop();
      try {
        await new Promise<void>((resolveStop, rejectStop) => {
          server.close((error) => {
            if (error) {
              if ((error as NodeJS.ErrnoException).code === "ERR_SERVER_NOT_RUNNING") {
                resolveStop();
                return;
              }
              rejectStop(error);
              return;
            }
            resolveStop();
          });
        });
      } finally {
        clearOwnedDaemonRuntimeDescriptor({
          pid: process.pid,
          host: options.host,
          port: actualPort,
          endpoint: `http://${options.host}:${actualPort}`,
          homeDir,
          launcher: options.launcherIdentity,
        });
      }
    },
  };
};
