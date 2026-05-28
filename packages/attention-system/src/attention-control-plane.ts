import { applyAttentionCommitWithContext, type AttentionEnsureContextInput } from "./attention-commit-application";
import type { AttentionCommit, AttentionCommitInput, AttentionContextState } from "./attention-item";
import { AttentionStore } from "./attention-store";
import { AttentionSystem } from "./attention-system";
import type { AttentionSystemSnapshot } from "./attention-types";

export interface AttentionControlPlaneEnsureContextInput extends AttentionEnsureContextInput {}

export interface AttentionControlPlaneCommitInput {
  context: AttentionControlPlaneEnsureContextInput;
  commit: AttentionCommitInput;
}

export interface AttentionControlPlaneCommitResult {
  context: AttentionContextState;
  commit: AttentionCommit;
  snapshot: AttentionSystemSnapshot;
}

/**
 * Durable writer for attention truth. External systems use this instead of
 * reaching into SessionRuntime private commit paths.
 */
export class AttentionControlPlane {
  private readonly store: AttentionStore;

  constructor(
    private readonly options: {
      root: string;
    },
  ) {
    this.store = new AttentionStore(this.options.root);
  }

  async loadSnapshot(): Promise<AttentionSystemSnapshot> {
    return await this.store.load();
  }

  async commit(input: AttentionControlPlaneCommitInput): Promise<AttentionControlPlaneCommitResult> {
    const system = AttentionSystem.fromSnapshot(await this.store.load());
    const result = applyAttentionCommitWithContext({
      system,
      context: input.context,
      commit: input.commit,
    });
    const snapshot = system.snapshot();
    await this.store.save(snapshot);
    return {
      context: result.context,
      commit: result.commit,
      snapshot,
    };
  }
}
