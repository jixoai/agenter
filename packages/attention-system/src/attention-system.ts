import { randomUUID } from "node:crypto";

import type {
  AttentionCommit,
  AttentionCommitInput,
  AttentionContextState,
  AttentionFocusState,
} from "./attention-item";
import type {
  AttentionActiveContextMatch,
  AttentionCommitMatch,
  AttentionContextDescriptor,
  AttentionQueryInput,
  AttentionSystemSnapshot,
} from "./attention-types";
import { AttentionContext } from "./attention-context";

const generateContextId = (): string => `ctx-${randomUUID()}`;

export class AttentionSystem {
  private readonly contexts = new Map<string, AttentionContext>();
  private readonly commitListeners = new Set<(contextId: string, context: AttentionContextState, commit: AttentionCommit) => void>();

  createContext(input: {
    contextId?: string;
    owner: string;
    focusState?: AttentionFocusState;
    content?: string;
    contentFormat?: string;
    scoreMap?: Record<string, number>;
  }): AttentionContext {
    const contextId = input.contextId ?? generateContextId();
    if (this.contexts.has(contextId)) {
      throw new Error(`attention context "${contextId}" already exists`);
    }
    return this.bindContext(
      new AttentionContext({
        contextId,
        owner: input.owner,
        focusState: input.focusState,
        content: input.content,
        contentFormat: input.contentFormat,
        scoreMap: input.scoreMap,
      }),
    );
  }

  getContext(contextId: string): AttentionContext | undefined {
    return this.contexts.get(contextId);
  }

  listContexts(): AttentionContextDescriptor[] {
    return [...this.contexts.values()].map((context) => {
      const state = context.getState();
      return {
        contextId: state.contextId,
        owner: state.owner,
        headCommitId: state.headCommitId,
        unresolvedScoreCount: context.unresolvedScoreCount(),
        updatedAt: state.updatedAt,
      };
    });
  }

  removeContext(contextId: string): void {
    this.contexts.delete(contextId);
  }

  setContextFocusState(contextId: string, focusState: AttentionFocusState): AttentionContextState {
    return this.requireContext(contextId).setFocusState(focusState);
  }

  listPushCommits(contextId: string, input: { includeConsumed?: boolean; limit?: number } = {}): AttentionCommit[] {
    return this.requireContext(contextId).listPushCommits(input);
  }

  consumePushes(contextId: string, commitIds?: readonly string[]): AttentionCommit[] {
    return this.requireContext(contextId).consumePushes(commitIds);
  }

  commit(contextId: string, input: AttentionCommitInput): { context: AttentionContextState; commit: AttentionCommit } {
    return this.requireContext(contextId).commit(input);
  }

  listActiveContexts(input: { minScore?: number; commitLimit?: number } = {}): AttentionActiveContextMatch[] {
    const minScore = Math.max(0, Math.trunc(input.minScore ?? 1));
    const commitLimit = Math.max(1, Math.trunc(input.commitLimit ?? 12));
    return [...this.contexts.values()]
      .filter((context) => context.isActive(minScore))
      .map((context) => ({
        contextId: context.contextId,
        context: context.getState(),
        recentCommits: context.listRecentCommits(commitLimit),
      }))
      .sort((left, right) => {
        const leftUpdated = Date.parse(left.context.updatedAt);
        const rightUpdated = Date.parse(right.context.updatedAt);
        if (leftUpdated !== rightUpdated) {
          return rightUpdated - leftUpdated;
        }
        return left.contextId.localeCompare(right.contextId);
      });
  }

  query(input: AttentionQueryInput = {}): AttentionCommitMatch[] {
    const contexts = input.contextId
      ? this.contexts.has(input.contextId)
        ? [this.requireContext(input.contextId)]
        : []
      : [...this.contexts.values()];
    const matches = contexts.flatMap((context) => context.queryCommits(input));
    matches.sort((left, right) => {
      const leftTime = Date.parse(left.commit.createdAt);
      const rightTime = Date.parse(right.commit.createdAt);
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return right.commit.commitId.localeCompare(left.commit.commitId);
    });
    const offset = Math.max(0, Math.trunc(input.offset ?? 0));
    const limit = Math.max(1, Math.trunc(input.limit ?? (matches.length || 1)));
    return matches.slice(offset, offset + limit);
  }

  onCommit(listener: (contextId: string, context: AttentionContextState, commit: AttentionCommit) => void): () => void {
    this.commitListeners.add(listener);
    return () => {
      this.commitListeners.delete(listener);
    };
  }

  snapshot(): AttentionSystemSnapshot {
    return {
      contexts: [...this.contexts.values()].map((context) => context.snapshot()),
    };
  }

  static fromSnapshot(snapshot: AttentionSystemSnapshot): AttentionSystem {
    const system = new AttentionSystem();
    for (const contextSnapshot of snapshot.contexts) {
      system.bindContext(
        new AttentionContext(
          {
            contextId: contextSnapshot.contextId,
            owner: contextSnapshot.owner,
            focusState: contextSnapshot.focusState,
          },
          contextSnapshot,
        ),
      );
    }
    return system;
  }

  private requireContext(contextId: string): AttentionContext {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`attention context "${contextId}" not found`);
    }
    return context;
  }

  private bindContext(context: AttentionContext): AttentionContext {
    this.contexts.set(context.contextId, context);
    context.onChange((commit, state) => {
      for (const listener of this.commitListeners) {
        listener(context.contextId, state, commit);
      }
    });
    return context;
  }
}
