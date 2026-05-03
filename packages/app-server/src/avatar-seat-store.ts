import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";

import {
  generatePrincipalKeyPair,
  principalIdFromPrivateKey,
  principalIdFromPublicKey,
  normalizePrincipalId,
  normalizePrincipalPrivateKey,
  normalizePrincipalPublicKey,
  type PrincipalAlgorithm,
  type PrincipalId,
  type PrincipalKeyPair,
} from "@agenter/principal-crypto";
import type { ManagedInvitationEndpointDescriptor } from "@agenter/managed-seat-invitation-handshake";
import type { MessageChannelAccessRole } from "@agenter/message-system";
import type { TerminalGrantRole } from "@agenter/terminal-system";
import { normalizeAvatarNickname } from "@agenter/avatar";

import {
  resolveWorkspaceAvatarAliasRoot,
  resolveWorkspaceAvatarCanonicalRoot,
  resolveWorkspaceAvatarSeatPath,
} from "./workspace-system";

export type AvatarSeatState = "active" | "credential-invalid";

export interface AvatarSeatAuthorityEndpoint extends ManagedInvitationEndpointDescriptor {}

export interface AvatarMessageSeatCredential {
  accessToken: string;
  accessRole: MessageChannelAccessRole;
  endpoint?: AvatarSeatAuthorityEndpoint;
  state: AvatarSeatState;
  updatedAt: string;
}

export interface AvatarTerminalSeatCredential {
  accessToken: string;
  accessRole: TerminalGrantRole;
  endpoint?: AvatarSeatAuthorityEndpoint;
  state: AvatarSeatState;
  updatedAt: string;
}

export interface AvatarPrincipalRecord extends Pick<PrincipalKeyPair, "algorithm" | "principalId" | "publicKey" | "privateKey"> {}

export interface AvatarSeatDocument {
  version: 2;
  principalId?: PrincipalId;
  algorithm?: PrincipalAlgorithm;
  publicKey?: PrincipalKeyPair["publicKey"];
  privateKey?: PrincipalKeyPair["privateKey"];
  messageSeats: Record<string, AvatarMessageSeatCredential>;
  terminalSeats: Record<string, AvatarTerminalSeatCredential>;
}

const createEmptyAvatarSeatDocument = (): AvatarSeatDocument => ({
  version: 2,
  messageSeats: {},
  terminalSeats: {},
});

const mergeLegacyAvatarDirectory = (sourceRoot: string, canonicalRoot: string): void => {
  mkdirSync(canonicalRoot, { recursive: true });
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    const sourcePath = join(sourceRoot, entry.name);
    const canonicalPath = join(canonicalRoot, entry.name);
    if (existsSync(canonicalPath)) {
      if (entry.isDirectory() && lstatSync(canonicalPath).isDirectory()) {
        mergeLegacyAvatarDirectory(sourcePath, canonicalPath);
        rmSync(sourcePath, { recursive: true, force: true });
        continue;
      }
      rmSync(sourcePath, { recursive: true, force: true });
      continue;
    }
    renameSync(sourcePath, canonicalPath);
  }
};

export const ensureAvatarNicknameAlias = (input: {
  workspacePath: string;
  avatar: string;
  principalId: string;
  homeDir?: string;
}): { canonicalRoot: string; aliasPath: string } => {
  const homeDir = input.homeDir ?? homedir();
  const canonicalRoot = resolveWorkspaceAvatarCanonicalRoot(input.workspacePath, input.principalId, homeDir);
  const aliasPath = resolveWorkspaceAvatarAliasRoot(input.workspacePath, input.avatar, homeDir);
  mkdirSync(canonicalRoot, { recursive: true });
  mkdirSync(dirname(aliasPath), { recursive: true });

  try {
    const stats = lstatSync(aliasPath);
    if (stats.isDirectory()) {
      mergeLegacyAvatarDirectory(aliasPath, canonicalRoot);
      rmSync(aliasPath, { recursive: true, force: true });
    } else if (!stats.isSymbolicLink()) {
      throw new Error(`avatar nickname alias path is not a symlink: ${aliasPath}`);
    }
    if (stats.isSymbolicLink()) {
      try {
        if (realpathSync(aliasPath) === canonicalRoot) {
          return { canonicalRoot, aliasPath };
        }
      } catch {
        // Fall through and replace stale or broken aliases.
      }
      rmSync(aliasPath, { recursive: true, force: true });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const relativeTarget = relative(dirname(aliasPath), canonicalRoot) || ".";
  symlinkSync(relativeTarget, aliasPath, "dir");
  return { canonicalRoot, aliasPath };
};

const nowIso = (): string => new Date().toISOString();

const normalizeSeatEndpoint = (value: unknown): AvatarSeatAuthorityEndpoint | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as {
    authorityUrl?: unknown;
    trpcPath?: unknown;
    acceptPath?: unknown;
  };
  if (typeof raw.authorityUrl !== "string" || raw.authorityUrl.trim().length === 0) {
    return undefined;
  }
  return {
    authorityUrl: raw.authorityUrl.trim().replace(/\/+$/u, ""),
    ...(typeof raw.trpcPath === "string" && raw.trpcPath.trim().length > 0 ? { trpcPath: raw.trpcPath.trim() } : {}),
    ...(typeof raw.acceptPath === "string" && raw.acceptPath.trim().length > 0
      ? { acceptPath: raw.acceptPath.trim() }
      : {}),
  };
};

const normalizeMessageSeatCredential = (value: unknown): AvatarMessageSeatCredential | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as {
    accessToken?: unknown;
    accessRole?: unknown;
    endpoint?: unknown;
    state?: unknown;
    updatedAt?: unknown;
  };
  if (
    typeof raw.accessToken !== "string" ||
    raw.accessToken.length === 0 ||
    typeof raw.accessRole !== "string" ||
    (raw.accessRole !== "admin" && raw.accessRole !== "member" && raw.accessRole !== "readonly")
  ) {
    return undefined;
  }
  return {
    accessToken: raw.accessToken,
    accessRole: raw.accessRole,
    endpoint: normalizeSeatEndpoint(raw.endpoint),
    state: raw.state === "credential-invalid" ? "credential-invalid" : "active",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
};

const normalizeTerminalSeatCredential = (value: unknown): AvatarTerminalSeatCredential | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as {
    accessToken?: unknown;
    accessRole?: unknown;
    endpoint?: unknown;
    state?: unknown;
    updatedAt?: unknown;
  };
  if (
    typeof raw.accessToken !== "string" ||
    raw.accessToken.length === 0 ||
    typeof raw.accessRole !== "string" ||
    (raw.accessRole !== "admin" &&
      raw.accessRole !== "writer" &&
      raw.accessRole !== "requester" &&
      raw.accessRole !== "readonly")
  ) {
    return undefined;
  }
  return {
    accessToken: raw.accessToken,
    accessRole: raw.accessRole,
    endpoint: normalizeSeatEndpoint(raw.endpoint),
    state: raw.state === "credential-invalid" ? "credential-invalid" : "active",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
};

export const resolveAvatarSeatSettingsPath = (workspacePath: string, avatar: string, homeDir = homedir()): string => {
  return resolveWorkspaceAvatarSeatPath(workspacePath, normalizeAvatarNickname(avatar), homeDir);
};

const readAvatarPrincipal = (value: {
  principalId?: unknown;
  algorithm?: unknown;
  publicKey?: unknown;
  privateKey?: unknown;
}): AvatarPrincipalRecord | undefined => {
  if (value.algorithm !== "secp256k1") {
    return undefined;
  }
  if (
    typeof value.principalId !== "string" ||
    typeof value.publicKey !== "string" ||
    typeof value.privateKey !== "string"
  ) {
    return undefined;
  }
  try {
    const principalId = normalizePrincipalId(value.principalId);
    const publicKey = normalizePrincipalPublicKey(value.publicKey);
    const privateKey = normalizePrincipalPrivateKey(value.privateKey);
    if (principalIdFromPrivateKey(privateKey) !== principalId) {
      return undefined;
    }
    if (principalIdFromPublicKey(publicKey) !== principalId) {
      return undefined;
    }
    return {
      principalId,
      algorithm: "secp256k1",
      publicKey,
      privateKey,
    };
  } catch {
    return undefined;
  }
};

const normalizeSeatDocument = (value: unknown): AvatarSeatDocument => {
  if (!value || typeof value !== "object") {
    return createEmptyAvatarSeatDocument();
  }
  const raw = value as {
    version?: unknown;
    principalId?: unknown;
    algorithm?: unknown;
    publicKey?: unknown;
    privateKey?: unknown;
    messageSeats?: Record<string, AvatarMessageSeatCredential>;
    terminalSeats?: Record<string, AvatarTerminalSeatCredential>;
  };
  const principal = readAvatarPrincipal(raw);
  return {
    version: 2,
    principalId: principal?.principalId,
    algorithm: principal?.algorithm,
    publicKey: principal?.publicKey,
    privateKey: principal?.privateKey,
    messageSeats: Object.fromEntries(
      Object.entries(raw.messageSeats ?? {}).flatMap(([chatId, seat]) => {
        const normalized = normalizeMessageSeatCredential(seat);
        return normalized ? [[chatId, normalized] as const] : [];
      }),
    ),
    terminalSeats: Object.fromEntries(
      Object.entries(raw.terminalSeats ?? {}).flatMap(([terminalId, seat]) => {
        const normalized = normalizeTerminalSeatCredential(seat);
        return normalized ? [[terminalId, normalized] as const] : [];
      }),
    ),
  };
};

export const readAvatarSeatDocument = (workspacePath: string, avatar: string, homeDir = homedir()): AvatarSeatDocument => {
  const filePath = resolveAvatarSeatSettingsPath(workspacePath, avatar, homeDir);
  if (!existsSync(filePath)) {
    return createEmptyAvatarSeatDocument();
  }
  try {
    return normalizeSeatDocument(JSON.parse(readFileSync(filePath, "utf8")) as unknown);
  } catch {
    return createEmptyAvatarSeatDocument();
  }
};

export const ensureAvatarSeatPrincipal = (input: {
  workspacePath: string;
  avatar: string;
  homeDir?: string;
}): AvatarPrincipalRecord => {
  const doc = readAvatarSeatDocument(input.workspacePath, input.avatar, input.homeDir);
  if (doc.principalId && doc.algorithm && doc.publicKey && doc.privateKey) {
    ensureAvatarNicknameAlias({
      workspacePath: input.workspacePath,
      avatar: input.avatar,
      principalId: doc.principalId,
      homeDir: input.homeDir,
    });
    return {
      principalId: doc.principalId,
      algorithm: doc.algorithm,
      publicKey: doc.publicKey,
      privateKey: doc.privateKey,
    };
  }
  const principal = generatePrincipalKeyPair();
  doc.version = 2;
  doc.principalId = principal.principalId;
  doc.algorithm = principal.algorithm;
  doc.publicKey = principal.publicKey;
  doc.privateKey = principal.privateKey;
  writeAvatarSeatDocument({
    workspacePath: input.workspacePath,
    avatar: input.avatar,
    doc,
    homeDir: input.homeDir,
  });
  return principal;
};

export const writeAvatarSeatDocument = (input: {
  workspacePath: string;
  avatar: string;
  doc: AvatarSeatDocument;
  homeDir?: string;
}): AvatarSeatDocument => {
  const homeDir = input.homeDir ?? homedir();
  const filePath =
    typeof input.doc.principalId === "string"
      ? join(
          ensureAvatarNicknameAlias({
            workspacePath: input.workspacePath,
            avatar: input.avatar,
            principalId: input.doc.principalId,
            homeDir,
          }).canonicalRoot,
          "settings.local.json",
        )
      : resolveAvatarSeatSettingsPath(input.workspacePath, input.avatar, homeDir);
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
  endpoint?: AvatarSeatAuthorityEndpoint;
  state?: AvatarSeatState;
  homeDir?: string;
}): AvatarSeatDocument => {
  ensureAvatarSeatPrincipal({
    workspacePath: input.workspacePath,
    avatar: input.avatar,
    homeDir: input.homeDir,
  });
  const doc = readAvatarSeatDocument(input.workspacePath, input.avatar, input.homeDir);
  doc.messageSeats[input.chatId] = {
    accessToken: input.accessToken,
    accessRole: input.accessRole,
    endpoint: normalizeSeatEndpoint(input.endpoint),
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
  endpoint?: AvatarSeatAuthorityEndpoint;
  state?: AvatarSeatState;
  homeDir?: string;
}): AvatarSeatDocument => {
  ensureAvatarSeatPrincipal({
    workspacePath: input.workspacePath,
    avatar: input.avatar,
    homeDir: input.homeDir,
  });
  const doc = readAvatarSeatDocument(input.workspacePath, input.avatar, input.homeDir);
  doc.terminalSeats[input.terminalId] = {
    accessToken: input.accessToken,
    accessRole: input.accessRole,
    endpoint: normalizeSeatEndpoint(input.endpoint),
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
  ensureAvatarSeatPrincipal({
    workspacePath: input.workspacePath,
    avatar: input.avatar,
    homeDir: input.homeDir,
  });
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
