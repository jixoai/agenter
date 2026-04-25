import type { AttentionActiveContextMatch } from "@agenter/attention-system";

import type { RuntimeSkillRefreshResult } from "../runtime-skill-system";
import type { RuntimeSystemKernelAdapter, RuntimeSystemKernelHost } from "./types";

export interface RuntimeSkillKernelApplyResult {
  systemCommitId: string | null;
  reminderCommitId: string | null;
  reminderCommitIds: string[];
  bootstrapPending: boolean;
}

interface RuntimeSkillKernelAdapterOptions {
  ensureAttentionContext: () => void;
  getBootstrapContext: () => AttentionActiveContextMatch | null;
}

export class RuntimeSkillKernelAdapter implements RuntimeSystemKernelAdapter {
  readonly name = "skill";

  private host: RuntimeSystemKernelHost | null = null;
  private pendingBootstrap = false;

  constructor(private readonly options: RuntimeSkillKernelAdapterOptions) {}

  mount(host: RuntimeSystemKernelHost): void {
    this.host = host;
  }

  reset(): void {
    this.pendingBootstrap = false;
  }

  clearPendingBootstrap(): void {
    this.pendingBootstrap = false;
  }

  markBootstrapPending(): void {
    this.pendingBootstrap = true;
    this.options.ensureAttentionContext();
  }

  consumeBootstrapContext(): AttentionActiveContextMatch | null {
    if (!this.pendingBootstrap) {
      return null;
    }
    this.pendingBootstrap = false;
    return this.options.getBootstrapContext();
  }

  async applyRefreshResult(
    result: RuntimeSkillRefreshResult,
    input: { notifyLoop: boolean },
  ): Promise<RuntimeSkillKernelApplyResult> {
    this.options.ensureAttentionContext();

    let systemCommitId: string | null = null;
    if (result.systemIngress && this.host) {
      const committed = await this.host.commitIngress(result.systemIngress, { notifyLoop: false });
      systemCommitId = committed?.commit.commitId ?? null;
    }

    const reminderCommitIds: string[] = [];
    if (this.host) {
      for (const envelope of result.reminderIngresses) {
        const committed = await this.host.commitIngress(envelope, { notifyLoop: input.notifyLoop });
        if (committed) {
          reminderCommitIds.push(committed.commit.commitId);
        }
      }
    }

    if (result.bootstrapPending) {
      this.pendingBootstrap = true;
    }

    return {
      systemCommitId,
      reminderCommitId: reminderCommitIds[0] ?? null,
      reminderCommitIds,
      bootstrapPending: this.pendingBootstrap,
    };
  }
}
