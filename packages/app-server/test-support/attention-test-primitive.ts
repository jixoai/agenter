import type { AttentionActiveContextMatch } from "@agenter/attention-system";

import type { SessionRuntimeAttentionState } from "../src";

export interface AttentionScenarioScope {
  includeActiveMatch?: (match: AttentionActiveContextMatch) => boolean;
}

export interface AttentionWaitForValueInput {
  label: string;
  timeoutMs?: number;
}

export type AttentionWaitForValue = <T>(
  read: () => Promise<T | null> | T | null,
  input: AttentionWaitForValueInput,
) => Promise<T>;

const includeAllActiveMatches = (): boolean => true;

export const createAttentionScenarioScope = (scope: AttentionScenarioScope = {}): AttentionScenarioScope => ({
  includeActiveMatch: scope.includeActiveMatch ?? includeAllActiveMatches,
});

export const excludeActiveContextPrefixes = (...prefixes: string[]): AttentionScenarioScope =>
  createAttentionScenarioScope({
    includeActiveMatch: (match) => prefixes.every((prefix) => !match.contextId.startsWith(prefix)),
  });

export const filterAttentionByScenarioScope = (
  attention: SessionRuntimeAttentionState,
  scope: AttentionScenarioScope,
): SessionRuntimeAttentionState => {
  const includeActiveMatch = scope.includeActiveMatch ?? includeAllActiveMatches;
  return {
    ...attention,
    active: attention.active.filter((match) => includeActiveMatch(match)),
  };
};

export const waitForScopedAttentionSettled = async (
  readAttention: () => Promise<SessionRuntimeAttentionState>,
  waitForValue: AttentionWaitForValue,
  scope: AttentionScenarioScope,
  timeoutMs?: number,
): Promise<SessionRuntimeAttentionState> =>
  await waitForValue(
    async () => {
      const attention = filterAttentionByScenarioScope(await readAttention(), scope);
      return attention.active.length === 0 ? attention : null;
    },
    {
      label: "attention convergence",
      timeoutMs,
    },
  );
