import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { normalizePrincipalPrivateKey, principalIdFromPrivateKey } from "@agenter/principal-crypto";

import {
  getRuntimeToolDescriptorByRoute,
  type RuntimeLocalApiHandlers,
} from "./runtime-tool-descriptors";

export interface RuntimeLocalApiHandle {
  baseUrl: string;
  stop: () => Promise<void>;
}

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

const writeJson = (response: ServerResponse, statusCode: number, body: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(body)}\n`);
};

const assertAuthorized = (request: IncomingMessage, expectedPrincipalId: string): void => {
  const privateKey = request.headers["x-agenter-principal-key"];
  if (typeof privateKey !== "string" || privateKey.trim().length === 0) {
    throw new Error("missing principal key");
  }
  const resolvedPrincipal = principalIdFromPrivateKey(normalizePrincipalPrivateKey(privateKey));
  if (resolvedPrincipal !== expectedPrincipalId) {
    throw new Error("principal key does not match runtime principal");
  }
};

export const startRuntimeLocalApi = async (input: {
  expectedPrincipalId: string;
  handlers: RuntimeLocalApiHandlers;
}): Promise<RuntimeLocalApiHandle> => {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        writeJson(response, 200, { ok: true });
        return;
      }
      if (request.method !== "POST" || !request.url) {
        writeJson(response, 404, { ok: false, error: "not found" });
        return;
      }
      assertAuthorized(request, input.expectedPrincipalId);
      const descriptor = getRuntimeToolDescriptorByRoute(request.url);
      if (!descriptor) {
        writeJson(response, 404, { ok: false, error: "not found" });
        return;
      }
      const abortController = new AbortController();
      const abortIfResponseDidNotFinish = (): void => {
        if (!response.writableEnded) {
          abortController.abort();
        }
      };
      request.once("aborted", abortIfResponseDidNotFinish);
      response.once("close", abortIfResponseDidNotFinish);
      const rawBody = await readJsonBody(request);
      const parsedBody = descriptor.inputSchema.parse(rawBody);
      const result = await descriptor.handler(parsedBody, input.handlers, {
        signal: abortController.signal,
      });
      writeJson(response, 200, { ok: true, ...result });
    } catch (error) {
      writeJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });

  const address = server.address();
  if (!address || typeof address !== "object" || typeof address.port !== "number") {
    throw new Error("runtime local api failed to bind a loopback port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    stop: async () => {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }
          resolveClose();
        });
      });
    },
  };
};
