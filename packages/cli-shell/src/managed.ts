import type {
  AttentionQueryItem,
  AuthSessionOutput,
  ProductDelegationRecord,
} from "@agenter/client-sdk";
import {
  PRODUCT_HOSTING_DISABLED_SCORES,
  PRODUCT_HOSTING_ENABLED_SCORES,
  PRODUCT_HOSTING_SCORE_KEY,
  PRODUCT_HOSTING_USER_DISABLED_REASON,
} from "@agenter/product-extension-runtime";

import type { CliShellStore } from "./bootstrap";
import { CLI_SHELL_PRODUCT_ID } from "./product";

export const CLI_SHELL_DEFAULT_DELEGATION_TTL_MS = 30 * 60 * 1_000;

export interface CliShellManagedContext {
  sessionId: string;
  runtimeId: string;
  avatarActorId: string;
  shellName: string;
}

export interface CliShellManagedEnableInput extends CliShellManagedContext {
  store: CliShellStore;
  terminalId: string;
  roomId: string;
  objective?: string;
  notes?: string;
  delegationTtlMs?: number;
}

export interface CliShellManagedDisableInput extends CliShellManagedContext {
  store: CliShellStore;
  terminalId?: string;
  roomId?: string;
  notes?: string;
}

export interface CliShellManagedState {
  contextId: string;
  hostingMatches: AttentionQueryItem[];
  hostingActive: boolean;
  activeDelegation: ProductDelegationRecord | null;
  managed: boolean;
}

export interface CliShellManagedEnableResult {
  contextId: string;
  grantedByActorId: string;
  delegation: ProductDelegationRecord;
}

export interface CliShellManagedDisableResult {
  contextId: string;
  revokedDelegations: ProductDelegationRecord[];
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
  terminalId: string;
  roomId: string;
  avatarActorId: string;
  grantedByActorId: string;
  objective?: string;
  notes?: string;
}): string =>
  [
    `productId=${CLI_SHELL_PRODUCT_ID}`,
    `shellName=${input.shellName}`,
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
  terminalId?: string;
  roomId?: string;
  notes?: string;
}): string =>
  [
    `productId=${CLI_SHELL_PRODUCT_ID}`,
    `shellName=${input.shellName}`,
    input.terminalId?.trim() ? `terminalId=${input.terminalId.trim()}` : null,
    input.roomId?.trim() ? `roomId=${input.roomId.trim()}` : null,
    `reason=${PRODUCT_HOSTING_USER_DISABLED_REASON}`,
    input.notes?.trim() ? `notes=${input.notes.trim()}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

const resolveLatestActiveDelegation = (
  delegations: readonly ProductDelegationRecord[],
): ProductDelegationRecord | null =>
  [...delegations]
    .filter((record) => record.status === "active")
    .sort((left, right) => right.enabledAt - left.enabledAt)[0] ?? null;

export const buildCliShellHostingContextId = (shellName: string): string => `ctx-hosting-${shellName}`;

export const readCliShellManagedState = async (input: {
  store: CliShellStore;
  sessionId: string;
  runtimeId: string;
  avatarActorId: string;
  shellName: string;
}): Promise<CliShellManagedState> => {
  const runtimeClient = input.store;
  const contextId = buildCliShellHostingContextId(input.shellName);
  const [hostingMatches, delegations] = await Promise.all([
    runtimeClient.queryAttention({
      sessionId: input.sessionId,
      query: `contextId:${contextId} minscore:1`,
    }),
    runtimeClient.listProductDelegations({
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: input.shellName,
      runtimeId: input.runtimeId,
      avatarActorId: input.avatarActorId,
    }),
  ]);
  const activeDelegation = resolveLatestActiveDelegation(delegations);
  const hostingActive = hostingMatches.some(
    (match) => match.contextId === contextId && (match.commit.scores[PRODUCT_HOSTING_SCORE_KEY] ?? 0) > 0,
  );
  return {
    contextId,
    hostingMatches,
    hostingActive,
    activeDelegation,
    managed: hostingActive && activeDelegation !== null,
  };
};

export const enableCliShellManagedMode = async (input: CliShellManagedEnableInput): Promise<CliShellManagedEnableResult> => {
  const runtimeClient = input.store;
  const contextId = buildCliShellHostingContextId(input.shellName);
  const grantedByActorId = resolveGrantedByActorId(await input.store.getAuthSession());
  const activeDelegation = resolveLatestActiveDelegation(
    await runtimeClient.listProductDelegations({
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: input.shellName,
      runtimeId: input.runtimeId,
      avatarActorId: input.avatarActorId,
    }),
  );

  await runtimeClient.commitAttention({
    sessionId: input.sessionId,
    contextId,
    summary: `Managed hosting enabled for ${input.shellName}`,
    body: buildManagedObjectiveBody({
      shellName: input.shellName,
      terminalId: input.terminalId,
      roomId: input.roomId,
      avatarActorId: input.avatarActorId,
      grantedByActorId,
      objective: input.objective,
      notes: input.notes,
    }),
    scores: PRODUCT_HOSTING_ENABLED_SCORES,
    meta: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: input.shellName,
      terminalId: input.terminalId,
      roomId: input.roomId,
      avatarActorId: input.avatarActorId,
      grantedByActorId,
    },
  });

  if (activeDelegation) {
    return {
      contextId,
      grantedByActorId,
      delegation: activeDelegation,
    };
  }

  const now = Date.now();
  const delegation = await runtimeClient.createProductDelegation({
    productId: CLI_SHELL_PRODUCT_ID,
    resourceKey: input.shellName,
    runtimeId: input.runtimeId,
    avatarActorId: input.avatarActorId,
    grantedByActorId,
    terminalId: input.terminalId,
    roomId: input.roomId,
    enabledAt: now,
    expiresAt: now + Math.max(1_000, input.delegationTtlMs ?? CLI_SHELL_DEFAULT_DELEGATION_TTL_MS),
    policy: {
      mode: "write",
    },
    provenance: {
      source: "cli-shell",
      attentionContextId: contextId,
      notes: input.notes?.trim() || input.objective?.trim() || undefined,
    },
  });
  return {
    contextId,
    grantedByActorId,
    delegation,
  };
};

export const disableCliShellManagedMode = async (input: CliShellManagedDisableInput): Promise<CliShellManagedDisableResult> => {
  const runtimeClient = input.store;
  const contextId = buildCliShellHostingContextId(input.shellName);
  const activeDelegations = (await runtimeClient.listProductDelegations({
    productId: CLI_SHELL_PRODUCT_ID,
    resourceKey: input.shellName,
    runtimeId: input.runtimeId,
    avatarActorId: input.avatarActorId,
  })).filter((record) => record.status === "active");

  const revokedDelegations: ProductDelegationRecord[] = [];
  for (const delegation of activeDelegations) {
    revokedDelegations.push(
      await runtimeClient.revokeProductDelegation({
        delegationId: delegation.delegationId,
        revokedAt: Date.now(),
        revokedReason: PRODUCT_HOSTING_USER_DISABLED_REASON,
      }),
    );
  }

  await runtimeClient.settleAttention({
    sessionId: input.sessionId,
    contextId,
    summary: `Managed hosting disabled for ${input.shellName}`,
    body: buildManagedDisableBody({
      shellName: input.shellName,
      terminalId: input.terminalId,
      roomId: input.roomId,
      notes: input.notes,
    }),
    scores: PRODUCT_HOSTING_DISABLED_SCORES,
    reason: PRODUCT_HOSTING_USER_DISABLED_REASON,
    meta: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: input.shellName,
      terminalId: input.terminalId,
      roomId: input.roomId,
      avatarActorId: input.avatarActorId,
    },
  });

  return {
    contextId,
    revokedDelegations,
  };
};
