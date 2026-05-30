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

import { CLI_SHELL_APP_ID } from "./app";

type CliShellManagedStore = Pick<
  AppRuntimeStore,
  | "queryAttention"
  | "commitAttention"
  | "settleAttention"
> & {
  getAuthSession(): Promise<AuthSessionOutput | null>;
};

export interface CliShellManagedContext {
  sessionId: string;
  runtimeId: string;
  avatarActorId: string;
  shellName: string;
}

export interface CliShellManagedEnableInput extends CliShellManagedContext {
  store: CliShellManagedStore;
  surfaceId: string;
  terminalId: string;
  roomId: string;
  objective?: string;
  notes?: string;
}

export interface CliShellManagedDisableInput extends CliShellManagedContext {
  store: CliShellManagedStore;
  surfaceId?: string;
  terminalId?: string;
  roomId?: string;
  notes?: string;
}

export interface CliShellManagedState {
  contextId: string;
  hostingMatches: AttentionQueryItem[];
  hostingActive: boolean;
  managed: boolean;
}

export interface CliShellManagedEnableResult {
  contextId: string;
  grantedByActorId: string;
}

export interface CliShellManagedDisableResult {
  contextId: string;
}

const resolveGrantedByActorId = (authSession: AuthSessionOutput | null): string => {
  const authId = authSession?.claims.authId?.trim();
  if (!authId) {
    throw new Error("cli-shell managed mode requires an authenticated actor");
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
    `appId=${CLI_SHELL_APP_ID}`,
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
    `appId=${CLI_SHELL_APP_ID}`,
    `shellName=${input.shellName}`,
    input.surfaceId?.trim() ? `surfaceId=${input.surfaceId.trim()}` : null,
    input.terminalId?.trim() ? `terminalId=${input.terminalId.trim()}` : null,
    input.roomId?.trim() ? `roomId=${input.roomId.trim()}` : null,
    `reason=${APP_HOSTING_USER_DISABLED_REASON}`,
    input.notes?.trim() ? `notes=${input.notes.trim()}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

export const buildCliShellHostingContextId = (shellName: string): string => `ctx-hosting-${shellName}`;

export const readCliShellManagedState = async (input: {
  store: CliShellManagedStore;
  sessionId: string;
  runtimeId: string;
  avatarActorId: string;
  shellName: string;
}): Promise<CliShellManagedState> => {
  const runtimeClient = input.store;
  const contextId = buildCliShellHostingContextId(input.shellName);
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

export const enableCliShellManagedMode = async (input: CliShellManagedEnableInput): Promise<CliShellManagedEnableResult> => {
  const runtimeClient = input.store;
  const contextId = buildCliShellHostingContextId(input.shellName);
  const grantedByActorId = resolveGrantedByActorId(await input.store.getAuthSession());
  // Managed/takeover is cli-shell hosting attention, not shell authority.
  // cli-shell is an extension app; its tmux host stays outside core TerminalSystem data structures.
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
      appId: CLI_SHELL_APP_ID,
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

export const disableCliShellManagedMode = async (input: CliShellManagedDisableInput): Promise<CliShellManagedDisableResult> => {
  const runtimeClient = input.store;
  const contextId = buildCliShellHostingContextId(input.shellName);
  // Disabling hosting settles cli-shell attention only. It must not mutate unrelated platform authority.
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
      appId: CLI_SHELL_APP_ID,
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
