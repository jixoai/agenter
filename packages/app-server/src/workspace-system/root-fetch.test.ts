import { describe, expect, test } from "bun:test";
import { createServer } from "node:http";

import { createTruthfulRootWorkspaceFetch } from "./root-fetch";

describe("Feature: truthful root workspace fetch", () => {
  test("Scenario: Given a dead loopback port When the fetch runs Then it rejects with a transport failure instead of synthesizing HTTP 502", async () => {
    const fetch = createTruthfulRootWorkspaceFetch();
    await expect(fetch("http://127.0.0.1:65500/")).rejects.toThrow(/transport failure/i);
  });

  test("Scenario: Given a live loopback server When the fetch runs Then it returns the real HTTP response", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("loopback-ok");
    });
    await new Promise<void>((resolveReady, rejectReady) => {
      server.once("error", rejectReady);
      server.listen(0, "127.0.0.1", () => resolveReady());
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    if (!port) {
      throw new Error("expected loopback test server port");
    }

    try {
      const fetch = createTruthfulRootWorkspaceFetch();
      const result = await fetch(`http://127.0.0.1:${port}/`);
      expect(result.status).toBe(200);
      expect(result.body).toBe("loopback-ok");
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    }
  });
});
