import { resolveProfileServiceConfig } from "../config";
import { ProfileService } from "../service/profile-service";
import { openProfileDatabase } from "../store/database";
import { ProfileStore } from "../store/profile-store";
import type { ProfileServiceOptions } from "../types";
import { createProfileServiceApp } from "./app";

export interface ProfileServiceRuntime {
  app: ReturnType<typeof createProfileServiceApp>;
  close: () => Promise<void>;
  host: string;
  port: number;
}

const defaultEmailChallengeLogger = async (event: {
  email: string;
  code: string;
  challengeId: string;
  expiresAt: string;
}): Promise<void> => {
  console.log(
    `[profile-service] email verification code email=${event.email} code=${event.code} challengeId=${event.challengeId} expiresAt=${event.expiresAt}`,
  );
};

export const createProfileServiceRuntime = async (
  options: ProfileServiceOptions = {},
): Promise<ProfileServiceRuntime> => {
  const config = resolveProfileServiceConfig(options);
  const database = await openProfileDatabase(config.dbPath);
  const store = new ProfileStore(database.connection, config.publicBaseUrl);
  await store.initialize();
  const service = new ProfileService(
    store,
    {
      webauthnOrigin: config.webauthnOrigin,
      webauthnRpId: config.webauthnRpId,
      webauthnRpName: config.webauthnRpName,
    },
    {
      onEmailChallengeIssued: options.onEmailChallengeIssued ?? defaultEmailChallengeLogger,
    },
  );
  const app = createProfileServiceApp({
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
  };
};
