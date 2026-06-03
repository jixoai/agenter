import { describe, expect, test } from "bun:test";

import { REAL_PUBLIC_WORKSPACE_SHELL_AUDIT_AVATAR_PROFILE } from "../test-support/real-ai-test-personas";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealPublicWorkspaceShellScenario } from "../test-support/real-public-workspace-shell-scenario";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI public-workspace shell profile separation", () => {
  realTest(
    "Scenario: Given a real provider When the assistant audits a mounted public-workspace through workspace_bash Then HOME and PATH stay caller-controlled and root-only env stays absent",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-public-workspace-shell",
        avatarNickname: REAL_PUBLIC_WORKSPACE_SHELL_AUDIT_AVATAR_PROFILE.nickname,
        agenterPromptContent: REAL_PUBLIC_WORKSPACE_SHELL_AUDIT_AVATAR_PROFILE.prompt,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const roomId = harness.room.chatId;

        const result = await runRealPublicWorkspaceShellScenario(harness);

        expect(result.finalReply.chatId).toBe(roomId);
        expect(result.finalReply.content).toBe("PUBLIC-WORKSPACE-OK");
        expect(result.toolTraceTools).toContain("workspace_list");
        expect(result.workspaceBashCommands.some((call) => call.workspaceId === result.workspaceId)).toBeTrue();
        expect(result.workspaceValues.HOME).toBe("/tmp/public-workspace-home");
        expect(result.workspaceValues.ROOT).toBe("");
        expect(result.workspaceValues.HOME_DIR).toBe("");
        expect(result.workspaceValues.PRIVATE).toBe("");
        expect(result.workspaceValues.PATH).toBe("/tmp/public-workspace-path");
        expect(
          result.rootBashCommands.some((command) => command.includes("marker_prefix=__AGT") || command.includes("/tmp/public-workspace-home")),
        ).toBeFalse();
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.some((call) => call.outcome === "done")).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 300_000 },
  );
});
