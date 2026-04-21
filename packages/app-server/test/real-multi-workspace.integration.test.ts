import { describe, expect, test } from "bun:test";

import { REAL_ROOM_TERMINAL_AVATAR_PROFILE } from "../test-support/real-ai-test-personas";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealMultiWorkspaceScenario } from "../test-support/real-multi-workspace-scenario";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

const MULTI_WORKSPACE_PROMPT = [
  REAL_ROOM_TERMINAL_AVATAR_PROFILE.prompt.trim(),
  "- When a task explicitly says to inspect a skill first, do that through `root_bash` before touching mounted project files.",
  "- For multi-workspace tasks, call `workspace_list` first and keep file work inside `workspace_bash`.",
  "- Do not use `root_bash` to read or write mounted project files when the task can be completed through `workspace_bash`.",
].join("\n");

describe("Feature: real AI multi-workspace runtime behavior", () => {
  realTest(
    "Scenario: Given a real provider When one runtime holds two mounted workspaces Then the avatar uses skill info plus workspace_list/workspace_bash to move verified content across mounts",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-multi-workspace",
        avatarNickname: "test-multi-workspace",
        agenterPromptContent: MULTI_WORKSPACE_PROMPT,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const result = await runRealMultiWorkspaceScenario(harness);

        expect(result.reply.content.trim()).toBe("MULTI-WORKSPACE-OK");
        expect(result.targetContent).toBe("TARGET-RESULT: ALPHA");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(
          result.rootBashCommands.some((command) => command.includes("skill info agenter-runtime")),
        ).toBeTrue();
        expect(result.rootBashCommands.some((command) => command.includes("brief.txt"))).toBeFalse();
        expect(result.rootBashCommands.some((command) => command.includes("result.txt"))).toBeFalse();
        expect(result.workspaceBashCalls.some((call) => call.workspaceId === result.sourceWorkspaceId)).toBeTrue();
        expect(result.workspaceBashCalls.some((call) => call.workspaceId === result.targetWorkspaceId)).toBeTrue();
      } finally {
        await harness.stop();
      }
    },
    { timeout: 420_000 },
  );
});
