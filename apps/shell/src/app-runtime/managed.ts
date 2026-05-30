import type {
  AttentionQueryItem,
  AuthSessionOutput,
  AppRuntimeStore,
} from "@agenter/client-sdk";
import {
  APP_HOSTING_DISABLED_SCORES,
  APP_HOSTING_ENABLED_SCORES,
  APP_HOSTING_SCORE_KEY,
  APP_HOSTING_USER_DISABLED_REASON,
} from "@agenter/app-runtime";

import { SHELL_APP_ID } from "./app";

type ShellManagedStore = Pick<
  AppRuntimeStore,
  | "queryAttention"
  | "commitAttention"
  | "settleAttention"
> & {
  getAuthSession(): Promise<AuthSessionOutput | null>;
};

export interface ShellManagedContext {
  sessionId: string;
  runtimeId: string;
  avatarActorId: string;
  shellName: string;
}

export interface ShellManagedEnableInput extends ShellManagedContext {
  store: ShellManagedStore;
  surfaceId: string;
  terminalId: string;
  roomId: string;
  objective?: string;
  notes?: string;
}

export interface ShellManagedDisableInput extends ShellManagedContext {
  store: ShellManagedStore;
  surfaceId?: string;
  terminalId?: string;
  roomId?: string;
  notes?: string;
}

export interface ShellManagedState {
  contextId: string;
  hostingMatches: AttentionQueryItem[];
  hostingActive: boolean;
  managed: boolean;
}

export interface ShellManagedEnableResult {
  contextId: string;
  grantedByActorId: string;
}

export interface ShellManagedDisableResult {
  contextId: string;
}

const resolveGrantedByActorId = (authSession: AuthSessionOutput | null): string => {
  const authId = authSession?.claims.authId?.trim();
  if (!authId) {
    throw new Error("shell managed mode requires an authenticated actor");
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
    `appId=${SHELL_APP_ID}`,
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
    `appId=${SHELL_APP_ID}`,
    `shellName=${input.shellName}`,
    input.surfaceId?.trim() ? `surfaceId=${input.surfaceId.trim()}` : null,
    input.terminalId?.trim() ? `terminalId=${input.terminalId.trim()}` : null,
    input.roomId?.trim() ? `roomId=${input.roomId.trim()}` : null,
    `reason=${APP_HOSTING_USER_DISABLED_REASON}`,
    input.notes?.trim() ? `notes=${input.notes.trim()}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

export const buildShellHostingContextId = (shellName: string): string => `ctx-hosting-${shellName}`;

export const readShellManagedState = async (input: {
  store: ShellManagedStore;
  sessionId: string;
  runtimeId: string;
  avatarActorId: string;
  shellName: string;
}): Promise<ShellManagedState> => {
  const runtimeClient = input.store;
  const contextId = buildShellHostingContextId(input.shellName);
  const hostingMatches = await runtimeClient.queryAttention({
    sessionId: input.sessionId,
    query: `contextId:${contextId} minscore:1`,
  });
  const hostingActive = hostingMatches.some(
    (match) => match.contextId === contextId && (match.commit.scores[APP_HOSTING_SCORE_KEY] ?? 0) > 0,
  );
  return {
    contextId,
    hostingMatches,
    hostingActive,
    managed: hostingActive,
  };
};

export const enableShellManagedMode = async (input: ShellManagedEnableInput): Promise<ShellManagedEnableResult> => {
  const runtimeClient = input.store;
  const contextId = buildShellHostingContextId(input.shellName);
  const grantedByActorId = resolveGrantedByActorId(await input.store.getAuthSession());
  // Managed/takeover is shell hosting attention, not shell authority.
  // shell hosting attention is app-local and must not become TerminalSystem authority.
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
    scores: APP_HOSTING_ENABLED_SCORES,
    meta: {
      appId: SHELL_APP_ID,
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

export const disableShellManagedMode = async (input: ShellManagedDisableInput): Promise<ShellManagedDisableResult> => {
  const runtimeClient = input.store;
  const contextId = buildShellHostingContextId(input.shellName);
  // Disabling hosting settles shell attention only. It must not mutate unrelated platform authority.
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
    scores: APP_HOSTING_DISABLED_SCORES,
    reason: APP_HOSTING_USER_DISABLED_REASON,
    meta: {
      appId: SHELL_APP_ID,
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
