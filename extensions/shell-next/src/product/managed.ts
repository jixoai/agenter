import type {
  AttentionQueryItem,
  AuthSessionOutput,
  ProductExtensionRuntimeStore,
} from "@agenter/client-sdk";
import {
  PRODUCT_HOSTING_DISABLED_SCORES,
  PRODUCT_HOSTING_ENABLED_SCORES,
  PRODUCT_HOSTING_SCORE_KEY,
  PRODUCT_HOSTING_USER_DISABLED_REASON,
} from "@agenter/product-extension-runtime";

import { SHELL_NEXT_PRODUCT_ID } from "./product";

type ShellNextManagedStore = Pick<
  ProductExtensionRuntimeStore,
  | "queryAttention"
  | "commitAttention"
  | "settleAttention"
> & {
  getAuthSession(): Promise<AuthSessionOutput | null>;
};

export interface ShellNextManagedContext {
  sessionId: string;
  runtimeId: string;
  avatarActorId: string;
  shellName: string;
}

export interface ShellNextManagedEnableInput extends ShellNextManagedContext {
  store: ShellNextManagedStore;
  surfaceId: string;
  terminalId: string;
  roomId: string;
  objective?: string;
  notes?: string;
}

export interface ShellNextManagedDisableInput extends ShellNextManagedContext {
  store: ShellNextManagedStore;
  surfaceId?: string;
  terminalId?: string;
  roomId?: string;
  notes?: string;
}

export interface ShellNextManagedState {
  contextId: string;
  hostingMatches: AttentionQueryItem[];
  hostingActive: boolean;
  managed: boolean;
}

export interface ShellNextManagedEnableResult {
  contextId: string;
  grantedByActorId: string;
}

export interface ShellNextManagedDisableResult {
  contextId: string;
}

const resolveGrantedByActorId = (authSession: AuthSessionOutput | null): string => {
  const authId = authSession?.claims.authId?.trim();
  if (!authId) {
    throw new Error("shell-next managed mode requires an authenticated actor");
  }
  return `auth:${authId}`;
};

const buildManagedObjectiveBody = (input: {
  shellName: string;
  surfaceId: string;
  terminalId: string;
  roomId: string;
  avatarActorId: string;
  grantedByActorId: string;
  objective?: string;
  notes?: string;
}): string =>
  [
    `productId=${SHELL_NEXT_PRODUCT_ID}`,
    `shellName=${input.shellName}`,
    `surfaceId=${input.surfaceId}`,
    `terminalId=${input.terminalId}`,
    `roomId=${input.roomId}`,
    `avatarActorId=${input.avatarActorId}`,
    `grantedByActorId=${input.grantedByActorId}`,
    input.objective?.trim() ? `objective=${input.objective.trim()}` : null,
    input.notes?.trim() ? `notes=${input.notes.trim()}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

const buildManagedDisableBody = (input: {
  shellName: string;
  surfaceId?: string;
  terminalId?: string;
  roomId?: string;
  notes?: string;
}): string =>
  [
    `productId=${SHELL_NEXT_PRODUCT_ID}`,
    `shellName=${input.shellName}`,
    input.surfaceId?.trim() ? `surfaceId=${input.surfaceId.trim()}` : null,
    input.terminalId?.trim() ? `terminalId=${input.terminalId.trim()}` : null,
    input.roomId?.trim() ? `roomId=${input.roomId.trim()}` : null,
    `reason=${PRODUCT_HOSTING_USER_DISABLED_REASON}`,
    input.notes?.trim() ? `notes=${input.notes.trim()}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

export const buildShellNextHostingContextId = (shellName: string): string => `ctx-hosting-${shellName}`;

export const readShellNextManagedState = async (input: {
  store: ShellNextManagedStore;
  sessionId: string;
  runtimeId: string;
  avatarActorId: string;
  shellName: string;
}): Promise<ShellNextManagedState> => {
  const runtimeClient = input.store;
  const contextId = buildShellNextHostingContextId(input.shellName);
  const hostingMatches = await runtimeClient.queryAttention({
    sessionId: input.sessionId,
    query: `contextId:${contextId} minscore:1`,
  });
  const hostingActive = hostingMatches.some(
    (match) => match.contextId === contextId && (match.commit.scores[PRODUCT_HOSTING_SCORE_KEY] ?? 0) > 0,
  );
  return {
    contextId,
    hostingMatches,
    hostingActive,
    managed: hostingActive,
  };
};

export const enableShellNextManagedMode = async (input: ShellNextManagedEnableInput): Promise<ShellNextManagedEnableResult> => {
  const runtimeClient = input.store;
  const contextId = buildShellNextHostingContextId(input.shellName);
  const grantedByActorId = resolveGrantedByActorId(await input.store.getAuthSession());
  // Managed/takeover is shell-next hosting attention, not shell authority.
  // shell-next hosting attention is product-local and must not become TerminalSystem authority.
  await runtimeClient.commitAttention({
    sessionId: input.sessionId,
    contextId,
    summary: `Managed hosting enabled for ${input.shellName}`,
    body: buildManagedObjectiveBody({
      shellName: input.shellName,
      surfaceId: input.surfaceId,
      terminalId: input.terminalId,
      roomId: input.roomId,
      avatarActorId: input.avatarActorId,
      grantedByActorId,
      objective: input.objective,
      notes: input.notes,
    }),
    scores: PRODUCT_HOSTING_ENABLED_SCORES,
    meta: {
      productId: SHELL_NEXT_PRODUCT_ID,
      resourceKey: input.shellName,
      surfaceId: input.surfaceId,
      terminalId: input.terminalId,
      roomId: input.roomId,
      avatarActorId: input.avatarActorId,
      grantedByActorId,
    },
  });

  return {
    contextId,
    grantedByActorId,
  };
};

export const disableShellNextManagedMode = async (input: ShellNextManagedDisableInput): Promise<ShellNextManagedDisableResult> => {
  const runtimeClient = input.store;
  const contextId = buildShellNextHostingContextId(input.shellName);
  // Disabling hosting settles shell-next attention only. It must not mutate unrelated platform authority.
  await runtimeClient.settleAttention({
    sessionId: input.sessionId,
    contextId,
    summary: `Managed hosting disabled for ${input.shellName}`,
    body: buildManagedDisableBody({
      shellName: input.shellName,
      surfaceId: input.surfaceId,
      terminalId: input.terminalId,
      roomId: input.roomId,
      notes: input.notes,
    }),
    scores: PRODUCT_HOSTING_DISABLED_SCORES,
    reason: PRODUCT_HOSTING_USER_DISABLED_REASON,
    meta: {
      productId: SHELL_NEXT_PRODUCT_ID,
      resourceKey: input.shellName,
      surfaceId: input.surfaceId,
      terminalId: input.terminalId,
      roomId: input.roomId,
      avatarActorId: input.avatarActorId,
    },
  });

  return {
    contextId,
  };
};
