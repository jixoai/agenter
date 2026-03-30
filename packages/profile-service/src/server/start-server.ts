import { serve } from "@hono/node-server";
import { createServer as createNetServer } from "node:net";
import type { ProfileServiceHandle, ProfileServiceOptions } from "../types";
import { createProfileServiceRuntime } from "./runtime";

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

export const startProfileServiceServer = async (options: ProfileServiceOptions = {}): Promise<ProfileServiceHandle> => {
  const host = options.host ?? "127.0.0.1";
  const runtime = await createProfileServiceRuntime({
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
        await runtime.close();
      }
    },
  };
};
