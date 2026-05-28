import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { MessageManagedSeatClass } from "@agenter/message-system";
import type { TerminalManagedSeatClass } from "@agenter/terminal-system";

import { AppKernel } from "../src";

export interface ManagedSeatAuthorityServer {
  authorityUrl: string;
  stop: () => Promise<void>;
}

const writeJson = (response: ServerResponse, statusCode: number, body: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(body)}\n`);
};

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

const readEndpoint = (
  value: unknown,
): { authorityUrl: string; trpcPath?: string; acceptPath?: string } | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return {
    authorityUrl: String(record.authorityUrl),
    ...(typeof record.trpcPath === "string" ? { trpcPath: record.trpcPath } : {}),
    ...(typeof record.acceptPath === "string" ? { acceptPath: record.acceptPath } : {}),
  };
};

export const startManagedSeatAuthorityServer = async (kernel: AppKernel): Promise<ManagedSeatAuthorityServer> => {
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer((request, response) => {
    void (async () => {
      try {
        if (!request.url) {
          writeJson(response, 404, { ok: false, error: "not found" });
          return;
        }
        const url = new URL(request.url, "http://127.0.0.1");
        if (request.method === "GET" && url.pathname === "/health") {
          writeJson(response, 200, { ok: true });
          return;
        }
        if (request.method !== "POST") {
          writeJson(response, 404, { ok: false, error: "not found" });
          return;
        }

        const body = (await readJsonBody(request)) as Record<string, unknown>;

        if (url.pathname === "/api/managed-seats/terminal/invite") {
          const invitation = kernel.inviteGlobalTerminalSeat({
            terminalId: String(body.terminalId),
            participantId: String(body.participantId),
            seatClass: body.seatClass as TerminalManagedSeatClass,
            label: typeof body.label === "string" ? body.label : undefined,
            expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : undefined,
            accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
            actorId: typeof body.actorId === "string" ? (body.actorId as never) : undefined,
            superadminActorId:
              typeof body.superadminActorId === "string" ? (body.superadminActorId as never) : undefined,
            endpoint: readEndpoint(body.endpoint),
          });
          writeJson(response, 200, { ok: true, invitation });
          return;
        }

        if (url.pathname === "/api/managed-seats/terminal/prepare-accept") {
          const result = kernel.prepareGlobalTerminalSeatAccept({
            descriptor: String(body.descriptor),
          });
          writeJson(response, 200, { ok: true, ...result });
          return;
        }

        if (url.pathname === "/api/managed-seats/terminal/accept") {
          const result = await kernel.acceptGlobalTerminalSeat({
            descriptor: String(body.descriptor),
            proof: (body.proof ?? {}) as {
              inviteePrincipalId: `0x${string}`;
              payload: string;
              signature: `0x${string}`;
            },
          });
          writeJson(response, 200, { ok: true, ...result });
          return;
        }

        if (url.pathname === "/api/managed-seats/terminal/config") {
          const result = kernel.configGlobalTerminalSeat({
            terminalId: String(body.terminalId),
            participantId: String(body.participantId),
            seatClass: body.seatClass as TerminalManagedSeatClass,
            label: typeof body.label === "string" ? body.label : undefined,
            expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : undefined,
            accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
            actorId: typeof body.actorId === "string" ? (body.actorId as never) : undefined,
            superadminActorId:
              typeof body.superadminActorId === "string" ? (body.superadminActorId as never) : undefined,
            endpoint: readEndpoint(body.endpoint),
          });
          writeJson(response, 200, { ok: true, result });
          return;
        }

        if (url.pathname === "/api/managed-seats/terminal/revoke") {
          const result = kernel.revokeGlobalTerminalSeat({
            terminalId: String(body.terminalId),
            participantId: String(body.participantId),
            actorId: typeof body.actorId === "string" ? (body.actorId as never) : undefined,
            superadminActorId:
              typeof body.superadminActorId === "string" ? (body.superadminActorId as never) : undefined,
            accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
          });
          writeJson(response, 200, { ok: true, result });
          return;
        }

        if (url.pathname === "/api/managed-seats/message/invite") {
          const invitation = kernel.inviteGlobalRoomSeat({
            chatId: String(body.chatId),
            participantId: String(body.participantId),
            seatClass: body.seatClass as MessageManagedSeatClass,
            label: typeof body.label === "string" ? body.label : undefined,
            expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : undefined,
            accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
            superadminContactId:
              typeof body.superadminContactId === "string" ? (body.superadminContactId as never) : undefined,
            endpoint: readEndpoint(body.endpoint),
          });
          writeJson(response, 200, { ok: true, invitation });
          return;
        }

        if (url.pathname === "/api/managed-seats/message/prepare-accept") {
          const result = kernel.prepareGlobalRoomSeatAccept({
            descriptor: String(body.descriptor),
          });
          writeJson(response, 200, { ok: true, ...result });
          return;
        }

        if (url.pathname === "/api/managed-seats/message/accept") {
          const result = await kernel.acceptGlobalRoomSeat({
            descriptor: String(body.descriptor),
            proof: (body.proof ?? {}) as {
              inviteePrincipalId: `0x${string}`;
              payload: string;
              signature: `0x${string}`;
            },
          });
          writeJson(response, 200, { ok: true, ...result });
          return;
        }

        if (url.pathname === "/api/managed-seats/message/config") {
          const result = kernel.configGlobalRoomSeat({
            chatId: String(body.chatId),
            participantId: String(body.participantId),
            seatClass: body.seatClass as MessageManagedSeatClass,
            label: typeof body.label === "string" ? body.label : undefined,
            expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : undefined,
            accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
            superadminContactId:
              typeof body.superadminContactId === "string" ? (body.superadminContactId as never) : undefined,
            endpoint: readEndpoint(body.endpoint),
          });
          writeJson(response, 200, { ok: true, result });
          return;
        }

        if (url.pathname === "/api/managed-seats/message/revoke") {
          const result = kernel.revokeGlobalRoomSeat({
            chatId: String(body.chatId),
            participantId: String(body.participantId),
            accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
            superadminContactId:
              typeof body.superadminContactId === "string" ? (body.superadminContactId as never) : undefined,
          });
          writeJson(response, 200, { ok: true, result });
          return;
        }

        if (url.pathname === "/trpc/message.globalSnapshot") {
          const snapshot = kernel.snapshotGlobalRoom({
            chatId: String(body.chatId),
            accessToken: String(body.accessToken),
            limit: typeof body.limit === "number" ? body.limit : undefined,
          });
          writeJson(response, 200, { snapshot });
          return;
        }

        if (url.pathname === "/trpc/message.globalSend") {
          const result = kernel.sendGlobalRoomMessage({
            chatId: String(body.chatId),
            accessToken: String(body.accessToken),
            text: String(body.text),
          });
          writeJson(response, 200, result);
          return;
        }

        if (url.pathname === "/trpc/terminal.globalRead") {
          const result = await kernel.readGlobalTerminal({
            terminalId: String(body.terminalId),
            accessToken: String(body.accessToken),
            mode:
              body.mode === "auto" || body.mode === "diff" || body.mode === "snapshot" ? body.mode : undefined,
            recordActivity: typeof body.recordActivity === "boolean" ? body.recordActivity : undefined,
            remark: typeof body.remark === "boolean" ? body.remark : undefined,
          });
          writeJson(response, 200, { result });
          return;
        }

        if (url.pathname === "/trpc/terminal.globalWrite") {
          const result = await kernel.writeGlobalTerminal({
            terminalId: String(body.terminalId),
            accessToken: String(body.accessToken),
            text: String(body.text),
            readMode:
              body.readMode === "auto" || body.readMode === "diff" || body.readMode === "snapshot"
                ? body.readMode
                : undefined,
            readRecordActivity: typeof body.readRecordActivity === "boolean" ? body.readRecordActivity : undefined,
            returnRead:
              typeof body.returnRead === "boolean" ||
              (body.returnRead !== null && typeof body.returnRead === "object" && !Array.isArray(body.returnRead))
                ? (body.returnRead as boolean | { throttleMs?: number; debounceMs?: number })
                : undefined,
          });
          writeJson(response, 200, result);
          return;
        }

        if (url.pathname === "/trpc/terminal.globalInput") {
          const result = await kernel.inputGlobalTerminal({
            terminalId: String(body.terminalId),
            accessToken: String(body.accessToken),
            text: String(body.text),
            readMode:
              body.readMode === "auto" || body.readMode === "diff" || body.readMode === "snapshot"
                ? body.readMode
                : undefined,
            readRecordActivity: typeof body.readRecordActivity === "boolean" ? body.readRecordActivity : undefined,
            returnRead:
              typeof body.returnRead === "boolean" ||
              (body.returnRead !== null && typeof body.returnRead === "object" && !Array.isArray(body.returnRead))
                ? (body.returnRead as boolean | { throttleMs?: number; debounceMs?: number })
                : undefined,
          });
          writeJson(response, 200, result);
          return;
        }

        writeJson(response, 404, { ok: false, error: "not found" });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });
  const address = server.address();
  if (!address || typeof address !== "object" || typeof address.port !== "number") {
    throw new Error("managed seat authority server failed to bind");
  }

  return {
    authorityUrl: `http://127.0.0.1:${address.port}`,
    stop: async () => {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    },
  };
};
