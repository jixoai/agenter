import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
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
  usedLegacyDataDir: boolean;
}

export type ResolvedProfileServiceConfig = ResolvedAuthServiceConfig;

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4591;
const DEFAULT_AUTH_JWT_TTL_MS = 1000 * 60 * 60;

const resolveDefaultDataDir = (): { dataDir: string; usedLegacyDataDir: boolean } => {
  const authDataDir = join(homedir(), ".agenter", "auth-service");
  const legacyDataDir = join(homedir(), ".agenter", "profile-service");
  if (!existsSync(authDataDir) && existsSync(legacyDataDir)) {
    return { dataDir: legacyDataDir, usedLegacyDataDir: true };
  }
  return { dataDir: authDataDir, usedLegacyDataDir: false };
};

export const resolveAuthServiceConfig = (options: AuthServiceOptions = {}): ResolvedAuthServiceConfig => {
  const defaultDataDir = resolveDefaultDataDir();
  const dataDir = resolve(options.dataDir ?? defaultDataDir.dataDir);
  const usesExistingLegacyStore =
    basename(dataDir) === "profile-service" &&
    existsSync(join(dataDir, "profile-service.duckdb")) &&
    !existsSync(join(dataDir, "auth-service.duckdb"));
  const usedLegacyDataDir = options.dataDir ? usesExistingLegacyStore : defaultDataDir.usedLegacyDataDir;
  mkdirSync(dataDir, { recursive: true });
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const publicBaseUrl = options.publicBaseUrl ?? `http://${host}:${port}`;
  const webauthnOrigin = options.webauthnOrigin ?? new URL(publicBaseUrl).origin;
  return {
    dataDir,
    dbPath: join(dataDir, usedLegacyDataDir ? "profile-service.duckdb" : "auth-service.duckdb"),
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
    usedLegacyDataDir,
  };
};

export const resolveProfileServiceConfig = (options: ProfileServiceOptions = {}): ResolvedProfileServiceConfig =>
  resolveAuthServiceConfig(options);
