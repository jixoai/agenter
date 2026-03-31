import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { MessageChannelAccessRole } from "@agenter/message-system";
import type { TerminalGrantRole } from "@agenter/terminal-system";
import { normalizeAvatarNickname } from "@agenter/avatar";

import { toWorkspaceCwd } from "./workspace-target";

export type AvatarSeatState = "active" | "credential-invalid";

export interface AvatarMessageSeatCredential {
  accessToken: string;
  accessRole: MessageChannelAccessRole;
  state: AvatarSeatState;
  updatedAt: string;
}

export interface AvatarTerminalSeatCredential {
  accessToken: string;
  accessRole: TerminalGrantRole;
  state: AvatarSeatState;
  updatedAt: string;
}

export interface AvatarSeatDocument {
  version: 1;
  messageSeats: Record<string, AvatarMessageSeatCredential>;
  terminalSeats: Record<string, AvatarTerminalSeatCredential>;
}

const DEFAULT_DOCUMENT: AvatarSeatDocument = {
  version: 1,
  messageSeats: {},
  terminalSeats: {},
};

const nowIso = (): string => new Date().toISOString();

export const resolveAvatarSeatSettingsPath = (workspacePath: string, avatar: string, homeDir = homedir()): string => {
  return join(toWorkspaceCwd(workspacePath, homeDir), ".agenter", "avatar", normalizeAvatarNickname(avatar), "settings.local.json");
};

const normalizeSeatDocument = (value: unknown): AvatarSeatDocument => {
  if (!value || typeof value !== "object") {
    return DEFAULT_DOCUMENT;
  }
  const raw = value as {
    version?: unknown;
    messageSeats?: Record<string, AvatarMessageSeatCredential>;
    terminalSeats?: Record<string, AvatarTerminalSeatCredential>;
  };
  return {
    version: 1,
    messageSeats: raw.messageSeats ?? {},
    terminalSeats: raw.terminalSeats ?? {},
  };
};

export const readAvatarSeatDocument = (workspacePath: string, avatar: string, homeDir = homedir()): AvatarSeatDocument => {
  const filePath = resolveAvatarSeatSettingsPath(workspacePath, avatar, homeDir);
  if (!existsSync(filePath)) {
    return DEFAULT_DOCUMENT;
  }
  try {
    return normalizeSeatDocument(JSON.parse(readFileSync(filePath, "utf8")) as unknown);
  } catch {
    return DEFAULT_DOCUMENT;
  }
};

export const writeAvatarSeatDocument = (input: {
  workspacePath: string;
  avatar: string;
  doc: AvatarSeatDocument;
  homeDir?: string;
}): AvatarSeatDocument => {
  const homeDir = input.homeDir ?? homedir();
  const filePath = resolveAvatarSeatSettingsPath(input.workspacePath, input.avatar, homeDir);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(input.doc, null, 2)}\n`, "utf8");
  return input.doc;
};

export const saveAvatarMessageSeatCredential = (input: {
  workspacePath: string;
  avatar: string;
  chatId: string;
  accessToken: string;
  accessRole: MessageChannelAccessRole;
  state?: AvatarSeatState;
  homeDir?: string;
}): AvatarSeatDocument => {
  const doc = readAvatarSeatDocument(input.workspacePath, input.avatar, input.homeDir);
  doc.messageSeats[input.chatId] = {
    accessToken: input.accessToken,
    accessRole: input.accessRole,
    state: input.state ?? "active",
    updatedAt: nowIso(),
  };
  return writeAvatarSeatDocument({
    workspacePath: input.workspacePath,
    avatar: input.avatar,
    doc,
    homeDir: input.homeDir,
  });
};

export const saveAvatarTerminalSeatCredential = (input: {
  workspacePath: string;
  avatar: string;
  terminalId: string;
  accessToken: string;
  accessRole: TerminalGrantRole;
  state?: AvatarSeatState;
  homeDir?: string;
}): AvatarSeatDocument => {
  const doc = readAvatarSeatDocument(input.workspacePath, input.avatar, input.homeDir);
  doc.terminalSeats[input.terminalId] = {
    accessToken: input.accessToken,
    accessRole: input.accessRole,
    state: input.state ?? "active",
    updatedAt: nowIso(),
  };
  return writeAvatarSeatDocument({
    workspacePath: input.workspacePath,
    avatar: input.avatar,
    doc,
    homeDir: input.homeDir,
  });
};

export const markAvatarSeatCredentialState = (input: {
  workspacePath: string;
  avatar: string;
  kind: "message" | "terminal";
  resourceId: string;
  state: AvatarSeatState;
  homeDir?: string;
}): AvatarSeatDocument => {
  const doc = readAvatarSeatDocument(input.workspacePath, input.avatar, input.homeDir);
  if (input.kind === "message") {
    const current = doc.messageSeats[input.resourceId];
    if (current) {
      doc.messageSeats[input.resourceId] = {
        ...current,
        state: input.state,
        updatedAt: nowIso(),
      };
    }
  } else {
    const current = doc.terminalSeats[input.resourceId];
    if (current) {
      doc.terminalSeats[input.resourceId] = {
        ...current,
        state: input.state,
        updatedAt: nowIso(),
      };
    }
  }
  return writeAvatarSeatDocument({
    workspacePath: input.workspacePath,
    avatar: input.avatar,
    doc,
    homeDir: input.homeDir,
  });
};
