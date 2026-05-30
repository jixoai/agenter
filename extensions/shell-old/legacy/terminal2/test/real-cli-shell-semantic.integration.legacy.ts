import { describe, expect, test } from "bun:test";

import { resolveRealCliShellModelConfig } from "../test-support/real-cli-shell-fixture";
import {
  REAL_CLI_SHELL_JUDGE_MAX_ATTEMPTS,
  REAL_CLI_SHELL_SCORE_THRESHOLD,
  REAL_CLI_SHELL_STYLE_SCENARIOS,
  runRealCliShellScenarioWithThreshold,
} from "../test-support/real-cli-shell-semantic-suite";

const hasRealModel = process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealCliShellModelConfig() !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI shell-assistant self-evolution", () => {
  for (const style of REAL_CLI_SHELL_STYLE_SCENARIOS) {
    realTest(
      `Scenario: Given ${style.id} collaboration evidence When shell-assistant learns through correction compact and reconnect Then semantic judge confirms durable adaptation without hosting leakage`,
      async () => {
        const scored = await runRealCliShellScenarioWithThreshold(style);

        expect(scored.rubric.totalScore).toBeGreaterThanOrEqual(REAL_CLI_SHELL_SCORE_THRESHOLD);
        expect(scored.attemptsUsed).toBeLessThanOrEqual(REAL_CLI_SHELL_JUDGE_MAX_ATTEMPTS);
        expect(scored.result.compactCycleId).toBeGreaterThan(0);
        expect(scored.result.replies.acknowledgement.length).toBeGreaterThan(0);
        expect(scored.result.replies.task.length).toBeGreaterThan(0);
        expect(scored.result.replies.correction.length).toBeGreaterThan(0);
        expect(scored.result.replies.reflection.length).toBeGreaterThan(0);
        expect(scored.result.replies.reuse.length).toBeGreaterThan(0);
        expect(scored.result.chatMessages.length).toBeGreaterThanOrEqual(10);
        expect(scored.result.modelCallCount).toBeGreaterThan(0);
        expect(scored.result.activeAttentionContexts.every((match) => (match.scoreMap.hosting ?? 0) <= 0)).toBe(true);
        expect(scored.result.memoryPack["user-model"]?.length ?? 0).toBeGreaterThan(0);
        expect(scored.result.memoryPack["pairing-playbook"]?.length ?? 0).toBeGreaterThan(0);
        expect(scored.result.memoryPack["self-evolution-log"]?.length ?? 0).toBeGreaterThan(0);
        if (scored.result.cacheMode === "proxy") {
          expect(scored.result.cacheDir).toBeTruthy();
          expect(scored.result.cacheFileCount).toBeGreaterThan(0);
        } else {
          expect(scored.result.cacheFileCount).toBe(0);
        }
      },
      { timeout: 720_000 },
    );
  }
});
