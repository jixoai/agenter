import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ProfileServiceOptions } from "./types";

export interface ResolvedProfileServiceConfig {
  dataDir: string;
  dbPath: string;
  host: string;
  port: number;
  publicBaseUrl: string;
  authJwtTtlMs: number;
  resvgLibraryPath?: string;
  webauthnOrigin: string;
  webauthnRpId: string;
  webauthnRpName: string;
  webauthnUiDir?: string;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4591;
const DEFAULT_AUTH_JWT_TTL_MS = 1000 * 60 * 60;

export const resolveProfileServiceConfig = (options: ProfileServiceOptions = {}): ResolvedProfileServiceConfig => {
  const dataDir = resolve(options.dataDir ?? join(homedir(), ".agenter", "profile-service"));
  mkdirSync(dataDir, { recursive: true });
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const publicBaseUrl = options.publicBaseUrl ?? `http://${host}:${port}`;
  const webauthnOrigin = options.webauthnOrigin ?? new URL(publicBaseUrl).origin;
  return {
    dataDir,
    dbPath: join(dataDir, "profile-service.duckdb"),
    host,
    port,
    publicBaseUrl,
    authJwtTtlMs: options.authJwtTtlMs ?? DEFAULT_AUTH_JWT_TTL_MS,
    resvgLibraryPath: options.resvgLibraryPath ? resolve(options.resvgLibraryPath) : undefined,
    webauthnOrigin,
    webauthnRpId: options.webauthnRpId ?? new URL(webauthnOrigin).hostname,
    webauthnRpName: options.webauthnRpName ?? "agenter profile-service",
    webauthnUiDir: options.webauthnUiDir ? resolve(options.webauthnUiDir) : undefined,
  };
};
