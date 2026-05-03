import { createReadStream, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";

import { AppKernel, appRouter, createTrpcContext, readBearerToken, type AppKernelOptions } from "@agenter/app-server";
import { z } from "zod";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer, type WebSocket } from "ws";
import { resolveWebUiEntryDocumentPath } from "./webui-static-root";

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

export interface TrpcServerOptions {
  host: string;
  port: number;
  globalSessionRoot?: string;
  workspacesPath?: string;
  workspaceCwd?: string;
  staticDir?: string;
  publicEnv?: Record<string, string>;
  homeDir?: string;
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
    superadminActorId: z.string().trim().min(1).optional(),
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
    superadminActorId: z.string().trim().min(1).optional(),
    endpoint: managedSeatEndpointSchema.optional(),
  })
  .strict();

const messageRevokeBodySchema = z
  .object({
    chatId: z.string().trim().min(1),
    participantId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1).optional(),
    superadminActorId: z.string().trim().min(1).optional(),
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
  const entryDocumentPath = resolveWebUiEntryDocumentPath(staticDir);
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

  const trpcHandler = createHTTPHandler({
    router: appRouter,
    createContext: async ({ req }) =>
      await createTrpcContext({
        kernel,
        authorizationHeader: req.headers.authorization ?? null,
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
      });
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

    if (req.method === "POST" && pathname === "/api/managed-seats/message/revoke") {
      setCors(res, allowedOrigin);
      void (async () => {
        try {
          const body = messageRevokeBodySchema.parse(await readJsonBody(req));
          const result = kernel.revokeGlobalRoomSeat({
            chatId: body.chatId,
            participantId: body.participantId,
            accessToken: body.accessToken,
            superadminActorId: body.superadminActorId as never,
          });
          sendJson(res, 200, { ok: true, result });
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

  server.on("upgrade", (req, socket, head) => {
    const pathname = req.url ? new URL(req.url, `http://${options.host}:${options.port}`).pathname : "";
    const allowedOrigin = resolveAllowedOrigin({
      requestOriginHeader: readRequestHeader(req.headers.origin) ?? undefined,
      host: options.host,
    });
    if (readRequestHeader(req.headers.origin) && !allowedOrigin) {
      socket.destroy();
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

  const actualPort = (server.address() as { port?: number } | null)?.port ?? options.port;
  kernel.setManagedSeatAuthorityUrl(`http://${options.host}:${actualPort}`);

  return {
    host: options.host,
    port: actualPort,
    kernel,
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
