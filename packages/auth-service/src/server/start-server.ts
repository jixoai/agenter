import { serve } from "@hono/node-server";
import { createServer as createNetServer } from "node:net";
import type { AuthServiceHandle, AuthServiceOptions, ProfileServiceHandle, ProfileServiceOptions } from "../types";
import { clearOwnedAuthServiceRuntimeDescriptor, writeAuthServiceRuntimeDescriptor } from "../runtime-descriptor";
import { createAuthServiceRuntime } from "./runtime";

const resolveEphemeralPort = async (host: string): Promise<number> =>
  await new Promise<number>((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port =
        typeof address === "object" && address !== null && "port" in address && typeof address.port === "number"
          ? address.port
          : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });

export const startAuthServiceServer = async (options: AuthServiceOptions = {}): Promise<AuthServiceHandle> => {
  const host = options.host ?? "127.0.0.1";
  const runtime = await createAuthServiceRuntime({
    ...options,
    host,
    port: options.port === 0 ? await resolveEphemeralPort(host) : options.port,
  });
  const server = serve({
    fetch: runtime.app.fetch,
    hostname: runtime.host,
    port: runtime.port,
  });
  const address = server.address();
  const resolvedPort =
    typeof address === "object" && address !== null && "port" in address && typeof address.port === "number"
      ? address.port
      : runtime.port;
  const endpoint = `http://${runtime.host}:${resolvedPort}`;
  writeAuthServiceRuntimeDescriptor({
    pid: process.pid,
    endpoint,
    dataDir: runtime.dataDir,
    rootAuthKeyPath: runtime.rootAuthKeyPath,
    updatedAt: new Date().toISOString(),
  });

  return {
    host: runtime.host,
    port: resolvedPort,
    stop: async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
      } finally {
        try {
          await runtime.close();
        } finally {
          clearOwnedAuthServiceRuntimeDescriptor({
            pid: process.pid,
            endpoint,
            dataDir: runtime.dataDir,
            rootAuthKeyPath: runtime.rootAuthKeyPath,
          });
        }
      }
    },
  };
};

export const startProfileServiceServer: (options?: ProfileServiceOptions) => Promise<ProfileServiceHandle> =
  startAuthServiceServer;
