import type { AttentionCommit, AttentionCommitInput, AttentionContextState, AttentionFocusState } from "./attention-item";
import type { AttentionSystem } from "./attention-system";

export interface AttentionEnsureContextInput {
  contextId: string;
  owner: string;
  focusState?: AttentionFocusState;
  template?: string;
  slots?: Record<string, string>;
  content?: string;
  contentFormat?: string;
  scoreMap?: Record<string, number>;
}

export interface ApplyAttentionCommitInput {
  system: AttentionSystem;
  context: AttentionEnsureContextInput;
  commit: AttentionCommitInput;
  commitMode?: "commit" | "system";
}

export interface ApplyAttentionCommitResult {
  context: AttentionContextState;
  commit: AttentionCommit;
  createdContext: boolean;
}

export const ensureAttentionContext = (
  system: AttentionSystem,
  input: AttentionEnsureContextInput,
): { context: AttentionContextState; createdContext: boolean } => {
  const existing = system.getContext(input.contextId);
  if (existing) {
    return {
      context: existing.getState(),
      createdContext: false,
    };
  }
  return {
    context: system
      .createContext({
        contextId: input.contextId,
        owner: input.owner,
        focusState: input.focusState,
        template: input.template,
        slots: input.slots,
        content: input.content,
        contentFormat: input.contentFormat,
        scoreMap: input.scoreMap,
      })
      .getState(),
    createdContext: true,
  };
};

export const applyAttentionCommitWithContext = (input: ApplyAttentionCommitInput): ApplyAttentionCommitResult => {
  const ensured = ensureAttentionContext(input.system, input.context);
  const ingressType = input.commit.ingressType ?? (ensured.context.focusState === "focused" ? "commit" : "push");
  const commitAction =
    input.commitMode === "system" ? input.system.commitSystem.bind(input.system) : input.system.commit.bind(input.system);
  const result = commitAction(input.context.contextId, {
    ...input.commit,
    ingressType,
  });
  return {
    context: result.context,
    commit: result.commit,
    createdContext: ensured.createdContext,
  };
};
