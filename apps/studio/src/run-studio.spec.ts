import { createServer, type Server } from "node:net";

import { afterEach, describe, expect, test } from "vitest";

import { assertStudioDevWebPortAvailable } from "./run-studio";

const servers: Server[] = [];

const listenOnEphemeralPort = async (): Promise<{ server: Server; port: number }> => {
  const server = createServer();
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("expected TCP server address");
  }
  return { server, port: address.port };
};

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("Feature: Studio dev server ownership", () => {
  test("Scenario: Given a stale Studio dev server owns the requested web port When starting dev mode Then startup fails before reusing stale runtime env", async () => {
    const { port } = await listenOnEphemeralPort();

    await expect(assertStudioDevWebPortAvailable({ webHost: "127.0.0.1", webPort: port })).rejects.toThrow(
      `studio dev web port 127.0.0.1:${port} is already in use`,
    );
  });
});
