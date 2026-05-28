import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import type { MessageContactId, MessageControlPlaneEntry } from "@agenter/message-system";

import {
  AppKernel,
  type AppKernelOptions,
  type PublicRoomEntry,
  type PublicRoomMessageRecord,
  type RoomMediaAsset,
  type SessionMeta,
} from "../src";
import {
  canProxyRealModelConfig,
  resolveRealModelConfig,
  startCachedRealModelProxy,
  type CachedModelProxyHandle,
  type RealModelConfig,
} from "./real-model-cache";

export const REAL_TEAM_PROJECT_ROOT = resolve(import.meta.dir, "../../..");
export type RealTeamParticipant = "backend" | "frontend";
const FULL_WORKSPACE_GRANT = [{ pattern: "/", mode: "rw" }] as const;

export interface RealTeamProjectRoom {
  room: PublicRoomEntry;
  userProjection: PublicRoomEntry;
  backendProjection: PublicRoomEntry;
  frontendProjection: PublicRoomEntry;
}

export interface RealTeamAttachmentBridgeResult {
  asset: RoomMediaAsset;
  sent: { ok: boolean; reason?: string };
}

const allocatePort = async (): Promise<number> => {
  const server = createNetServer();
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
  if (!port) {
    throw new Error("failed to allocate ephemeral port");
  }
  return port;
};

export interface RealTeamKernelHarness {
  rootDir: string;
  homeDir: string;
  workspacePath: string;
  kernel: AppKernel;
  config: RealModelConfig;
  proxy: CachedModelProxyHandle | null;
  backendSession: SessionMeta;
  frontendSession: SessionMeta;
  backendAvatarPromptPath: string | null;
  frontendAvatarPromptPath: string | null;
  backendActorId: MessageContactId;
  frontendActorId: MessageContactId;
  userActorId: `auth:${string}`;
  createProjectRoom: (input?: { title?: string; metadata?: Record<string, unknown> }) => Promise<RealTeamProjectRoom>;
  focusProjectRoom: (room: RealTeamProjectRoom, participants?: RealTeamParticipant[]) => Promise<void>;
  blurProjectRoom: (room: RealTeamProjectRoom, participants?: RealTeamParticipant[]) => Promise<void>;
  sendPrivatePrimer: (participant: RealTeamParticipant, text: string) => Promise<{ ok: boolean; reason?: string }>;
  listProjectRoomMessages: (room: Pick<RealTeamProjectRoom, "room">, limit?: number) => PublicRoomMessageRecord[];
  listProjectRoomAssets: (room: Pick<RealTeamProjectRoom, "room">) => RoomMediaAsset[];
  bridgeWorkspaceFileToProjectRoomAttachment: (input: {
    room: Pick<RealTeamProjectRoom, "room">;
    participant: RealTeamParticipant;
    relativePath: string;
    mimeType: string;
    messageText: string;
  }) => Promise<RealTeamAttachmentBridgeResult>;
  stop: () => Promise<void>;
}

export const createRealTeamKernelHarness = async (
  input: {
    backendAvatar?: string;
    frontendAvatar?: string;
    backendPromptContent?: string;
    frontendPromptContent?: string;
    userActorId?: `auth:${string}`;
    logger?: AppKernelOptions["logger"];
  } = {},
): Promise<RealTeamKernelHarness | null> => {
  const config = resolveRealModelConfig(REAL_TEAM_PROJECT_ROOT);
  if (!config) {
    return null;
  }

  const rootDir = await mkdtemp(join(tmpdir(), "agenter-real-team-"));
  const homeDir = join(rootDir, "home");
  const workspacePath = join(rootDir, "workspace");
  await mkdir(homeDir, { recursive: true });
  await mkdir(join(workspacePath, ".agenter"), { recursive: true });
  const backendAvatar = input.backendAvatar ?? "backend";
  const frontendAvatar = input.frontendAvatar ?? "frontend";
  const backendPromptContent = input.backendPromptContent?.trim();
  const frontendPromptContent = input.frontendPromptContent?.trim();
  const backendAvatarPromptPath = backendPromptContent
    ? join(homeDir, ".agenter", "avatars", "by-nickname", backendAvatar, "AGENTER.mdx")
    : null;
  const frontendAvatarPromptPath = frontendPromptContent
    ? join(homeDir, ".agenter", "avatars", "by-nickname", frontendAvatar, "AGENTER.mdx")
    : null;
  if (backendAvatarPromptPath && backendPromptContent) {
    await mkdir(join(homeDir, ".agenter", "avatars", "by-nickname", backendAvatar), { recursive: true });
    await writeFile(backendAvatarPromptPath, backendPromptContent, "utf8");
  }
  if (frontendAvatarPromptPath && frontendPromptContent) {
    await mkdir(join(homeDir, ".agenter", "avatars", "by-nickname", frontendAvatar), { recursive: true });
    await writeFile(frontendAvatarPromptPath, frontendPromptContent, "utf8");
  }

  let proxy: CachedModelProxyHandle | null = null;
  let providerBaseUrl = config.baseUrl;
  let providerApiKey = config.apiKey;

  if (canProxyRealModelConfig(config)) {
    const proxyPort = await allocatePort();
    proxy = await startCachedRealModelProxy({
      host: "127.0.0.1",
      port: proxyPort,
      config,
    });
    providerBaseUrl = `http://127.0.0.1:${proxyPort}/v1`;
    providerApiKey = "local-cache";
  }

  const settings = {
    ai: {
      activeProvider: "real-live",
      providers: {
        "real-live": {
          apiStandard: config.apiStandard,
          vendor: config.vendor,
          profile: config.profile,
          headers: config.headers,
          model: config.model,
          apiKey: providerApiKey,
          baseUrl: providerBaseUrl,
          temperature: 0,
          maxRetries: 1,
          maxToken: 64_000,
          compactThreshold: 0.75,
        },
      },
    },
  };
  await writeFile(join(workspacePath, ".agenter", "settings.json"), `${JSON.stringify(settings, null, 2)}\n`, "utf8");

  const kernel = new AppKernel({
    homeDir,
    globalSessionRoot: join(rootDir, "sessions"),
    archiveSessionRoot: join(rootDir, "archive", "sessions"),
    workspacesPath: join(rootDir, "workspaces.yaml"),
    logger: input.logger,
  });

  try {
    await kernel.start();
    const createParticipantSession = async (participant: RealTeamParticipant): Promise<SessionMeta> => {
      const session = await kernel.createSession({
        cwd: workspacePath,
        avatar: participant === "backend" ? backendAvatar : frontendAvatar,
        name: participant === "backend" ? "real-team-backend" : "real-team-frontend",
        autoStart: false,
      });
      await kernel.attachSessionPrimaryRoom(session.id, { focus: true });
      kernel.grantRuntimeWorkspace({
        runtimeId: session.id,
        workspacePath,
        grants: [...FULL_WORKSPACE_GRANT],
      });
      const started = await kernel.startSession(session.id);
      if (!started.primaryRoomId) {
        throw new Error(`real team ${participant} missing primary room after explicit attach`);
      }
      if (!kernel.listMessageChannels(started.id).some((channel) => channel.chatId === started.primaryRoomId)) {
        throw new Error(`real team ${participant} primary room was not restored at boot`);
      }
      if (
        !kernel.listRuntimeWorkspaceMounts(started.id).some((mount) => mount.workspacePath === resolve(workspacePath))
      ) {
        throw new Error(`real team ${participant} missing explicit workspace mount`);
      }
      if (kernel.listTerminals(started.id).length > 0) {
        throw new Error(`real team ${participant} booted with unexpected terminals`);
      }
      return started;
    };
    const backendSession = await createParticipantSession("backend");
    const frontendSession = await createParticipantSession("frontend");
    const backendActorId = backendSession.avatarPrincipalId as MessageContactId | undefined;
    const frontendActorId = frontendSession.avatarPrincipalId as MessageContactId | undefined;
    if (!backendActorId) {
      throw new Error("expected backend avatar principal id");
    }
    if (!frontendActorId) {
      throw new Error("expected frontend avatar principal id");
    }

    const getSession = (participant: RealTeamParticipant): SessionMeta =>
      participant === "backend" ? backendSession : frontendSession;
    const getActorId = (participant: RealTeamParticipant): MessageContactId =>
      participant === "backend" ? backendActorId : frontendActorId;
    const updateProjectRoomFocus = async (
      room: RealTeamProjectRoom,
      participants: RealTeamParticipant[],
      op: "add" | "remove",
    ): Promise<void> => {
      for (const participant of participants) {
        const session = getSession(participant);
        const projection = participant === "backend" ? room.backendProjection : room.frontendProjection;
        await kernel.focusMessageChannels({
          sessionId: session.id,
          op,
          channels: [{ chatId: room.room.chatId, accessToken: projection.accessToken }],
        });
      }
    };
    const requireProjection = (chatId: string, actorId: MessageContactId): PublicRoomEntry => {
      const projection = kernel
        .listGlobalRooms({ actorId, includeArchived: true })
        .find((item) => item.chatId === chatId);
      if (!projection) {
        throw new Error(`missing room projection for ${actorId} in room ${chatId}`);
      }
      return projection;
    };

    return {
      rootDir,
      homeDir,
      workspacePath,
      kernel,
      config,
      proxy,
      backendSession,
      frontendSession,
      backendAvatarPromptPath,
      frontendAvatarPromptPath,
      backendActorId,
      frontendActorId,
      userActorId: input.userActorId ?? "auth:kzf",
      createProjectRoom: async (roomInput = {}) => {
        const room = await kernel.createGlobalRoom({
          title: roomInput.title ?? "real-team-project-room",
          metadata: roomInput.metadata ?? { scenario: "real-team-project-room" },
          superadminContactId: input.userActorId ?? "auth:kzf",
          focus: true,
          initialUsers: [
            {
              contactId: input.userActorId ?? "auth:kzf",
              label: "user",
              role: "admin",
              focused: true,
            },
            {
              contactId: backendActorId,
              label: backendSession.avatar,
              role: "member",
              focused: false,
            },
            {
              contactId: frontendActorId,
              label: frontendSession.avatar,
              role: "member",
              focused: false,
            },
          ],
        });
        return {
          room,
          userProjection: requireProjection(room.chatId, input.userActorId ?? "auth:kzf"),
          backendProjection: requireProjection(room.chatId, backendActorId),
          frontendProjection: requireProjection(room.chatId, frontendActorId),
        };
      },
      focusProjectRoom: async (room, participants = ["backend", "frontend"]) =>
        await updateProjectRoomFocus(room, participants, "add"),
      blurProjectRoom: async (room, participants = ["backend", "frontend"]) =>
        await updateProjectRoomFocus(room, participants, "remove"),
      sendPrivatePrimer: async (participant, text) => await kernel.sendChat(getSession(participant).id, text),
      listProjectRoomMessages: (room, limit = 80) =>
        kernel
          .snapshotGlobalRoom({
            chatId: room.room.chatId,
            superadminContactId: input.userActorId ?? "auth:kzf",
            limit,
          })
          .items.slice()
          .sort((left, right) => left.createdAt - right.createdAt),
      listProjectRoomAssets: (room) =>
        kernel.listGlobalRoomAssets({
          chatId: room.room.chatId,
          superadminContactId: input.userActorId ?? "auth:kzf",
        }),
      bridgeWorkspaceFileToProjectRoomAttachment: async (bridgeInput) => {
        const bytes = new Uint8Array(await readFile(join(workspacePath, bridgeInput.relativePath)));
        const uploads = await kernel.uploadGlobalRoomAssets({
          chatId: bridgeInput.room.room.chatId,
          actorId: getActorId(bridgeInput.participant),
          files: [
            {
              name: basename(bridgeInput.relativePath),
              mimeType: bridgeInput.mimeType,
              bytes,
            },
          ],
        });
        const asset = uploads[0];
        if (!asset) {
          throw new Error(`failed to bridge workspace asset ${bridgeInput.relativePath}`);
        }
        const sent = kernel.sendGlobalRoomMessage({
          chatId: bridgeInput.room.room.chatId,
          actorId: getActorId(bridgeInput.participant),
          text: bridgeInput.messageText,
          assetIds: [asset.assetId],
        });
        return {
          asset,
          sent,
        };
      },
      stop: async () => {
        await kernel.abortSession(backendSession.id).catch(() => {});
        await kernel.abortSession(frontendSession.id).catch(() => {});
        await kernel.stop().catch(() => {});
        await proxy?.stop().catch(() => {});
        await rm(rootDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await kernel.stop().catch(() => {});
    await proxy?.stop().catch(() => {});
    await rm(rootDir, { recursive: true, force: true });
    throw error;
  }
};
