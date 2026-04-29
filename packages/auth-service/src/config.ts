import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { AuthServiceOptions, ProfileServiceOptions } from "./types";

export interface ResolvedAuthServiceConfig {
  dataDir: string;
  dbPath: string;
  rootAuthKeyPath: string;
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

export type ResolvedProfileServiceConfig = ResolvedAuthServiceConfig;

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4591;
const DEFAULT_AUTH_JWT_TTL_MS = 1000 * 60 * 60;

const resolveDefaultDataDir = (): string => join(homedir(), ".agenter", "auth-service");

export const resolveAuthServiceDataDir = (dataDir?: string): string => resolve(dataDir ?? resolveDefaultDataDir());

export const resolveAuthServiceConfig = (options: AuthServiceOptions = {}): ResolvedAuthServiceConfig => {
  const dataDir = resolveAuthServiceDataDir(options.dataDir);
  mkdirSync(dataDir, { recursive: true });
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const publicBaseUrl = options.publicBaseUrl ?? `http://${host}:${port}`;
  const webauthnOrigin = options.webauthnOrigin ?? new URL(publicBaseUrl).origin;
  return {
    dataDir,
    dbPath: join(dataDir, "auth-service.sqlite"),
    rootAuthKeyPath: join(dataDir, "root-auth.key"),
    host,
    port,
    publicBaseUrl,
    authJwtTtlMs: options.authJwtTtlMs ?? DEFAULT_AUTH_JWT_TTL_MS,
    resvgLibraryPath: options.resvgLibraryPath ? resolve(options.resvgLibraryPath) : undefined,
    webauthnOrigin,
    webauthnRpId: options.webauthnRpId ?? new URL(webauthnOrigin).hostname,
    webauthnRpName: options.webauthnRpName ?? "agenter auth-service",
    webauthnUiDir: options.webauthnUiDir ? resolve(options.webauthnUiDir) : undefined,
  };
};

export const resolveProfileServiceConfig = (options: ProfileServiceOptions = {}): ResolvedProfileServiceConfig =>
  resolveAuthServiceConfig(options);
