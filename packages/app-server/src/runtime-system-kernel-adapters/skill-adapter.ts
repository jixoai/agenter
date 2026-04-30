import type { RuntimeSkillRefreshResult } from "../runtime-skill-system";
import type { RuntimeSystemKernelAdapter, RuntimeSystemKernelHost } from "./types";

export interface RuntimeSkillKernelApplyResult {
  commitIds: string[];
}

export class RuntimeSkillKernelAdapter implements RuntimeSystemKernelAdapter {
  readonly name = "skill";

  private host: RuntimeSystemKernelHost | null = null;

  mount(host: RuntimeSystemKernelHost): void {
    this.host = host;
  }

  reset(): void {}

  async applyRefreshResult(
    result: RuntimeSkillRefreshResult,
    input: { notifyLoop: boolean },
  ): Promise<RuntimeSkillKernelApplyResult> {
    const commitIds: string[] = [];
    if (!this.host) {
      return { commitIds };
    }
    for (const [index, envelope] of result.publishedIngresses.entries()) {
      const committed = await this.host.commitIngress(envelope, {
        notifyLoop: index === result.publishedIngresses.length - 1 ? input.notifyLoop : false,
      });
      if (committed) {
        commitIds.push(committed.commit.commitId);
      }
    }
    return { commitIds };
  }
}
