import { createHash } from "node:crypto";

import { resolveRootAuthMaterial } from "../auth/root-auth";
import { resolveAuthServiceConfig } from "../config";
import { ProfileService } from "../service/profile-service";
import { openProfileDatabase } from "../store/database";
import { ProfileStore } from "../store/profile-store";
import type { AuthServiceOptions, ProfileServiceOptions } from "../types";
import { createAuthServiceApp } from "./app";

export interface AuthServiceRuntime {
  app: ReturnType<typeof createAuthServiceApp>;
  close: () => Promise<void>;
  host: string;
  port: number;
  dataDir: string;
  rootAuthKeyPath: string;
}

export type ProfileServiceRuntime = AuthServiceRuntime;

const defaultEmailChallengeLogger = async (event: {
  email: string;
  code: string;
  challengeId: string;
  expiresAt: string;
}): Promise<void> => {
  console.log(
    `[auth-service] email verification code email=${event.email} code=${event.code} challengeId=${event.challengeId} expiresAt=${event.expiresAt}`,
  );
};

const MANAGED_PRINCIPAL_ID_DOMAIN = "profile-service-managed-principal";

export const createAuthServiceRuntime = async (options: AuthServiceOptions = {}): Promise<AuthServiceRuntime> => {
  const config = resolveAuthServiceConfig(options);
  const rootAuth = resolveRootAuthMaterial({
    dataDir: config.dataDir,
    privateKey: options.rootAuthPrivateKey,
  });
  const database = await openProfileDatabase(config.dbPath);
  const managedPrincipalSecret = createHash("sha256")
    .update(`${MANAGED_PRINCIPAL_ID_DOMAIN}:${rootAuth.privateKey}`)
    .digest("hex");
  const store = new ProfileStore(database.connection, config.publicBaseUrl, managedPrincipalSecret);
  await store.initialize();
  const service = new ProfileService(
    store,
    {
      publicBaseUrl: config.publicBaseUrl,
      authJwtIssuer: config.publicBaseUrl,
      authJwtSecret: createHash("sha256").update(rootAuth.privateKey).digest("hex"),
      authJwtTtlMs: config.authJwtTtlMs,
      rootAuthId: rootAuth.authId,
      rootAuthPrivateKey: rootAuth.privateKey,
      rootIdentifier: rootAuth.identifier,
      rootAuthKeyPath: config.rootAuthKeyPath,
      rootAuthBootstrapMode: "managed_local",
      canRevealRootAuthPrivateKey: true,
      webauthnOrigin: config.webauthnOrigin,
      webauthnRpId: config.webauthnRpId,
      webauthnRpName: config.webauthnRpName,
    },
    {
      onEmailChallengeIssued: options.onEmailChallengeIssued ?? defaultEmailChallengeLogger,
    },
  );
  const app = createAuthServiceApp({
    service,
    publicBaseUrl: config.publicBaseUrl,
    resvgLibraryPath: config.resvgLibraryPath,
    webauthnUiDir: config.webauthnUiDir,
  });
  return {
    app,
    close: async () => {
      await database.close();
    },
    host: config.host,
    port: config.port,
    dataDir: config.dataDir,
    rootAuthKeyPath: config.rootAuthKeyPath,
  };
};

export const createProfileServiceRuntime: (options?: ProfileServiceOptions) => Promise<ProfileServiceRuntime> =
  createAuthServiceRuntime;
