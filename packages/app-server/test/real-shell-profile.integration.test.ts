import { describe, expect, test } from "bun:test";

import { REAL_SHELL_PROFILE_AUDIT_AVATAR_PROFILE } from "../test-support/real-ai-test-personas";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealShellProfileScenario } from "../test-support/real-shell-profile-scenario";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI shell profile separation", () => {
  realTest(
    "Scenario: Given a real provider When the assistant audits root-workspace shell and a shared terminal from avatar-root cwd Then root HOME stays rewritten while the terminal keeps collaborative env semantics",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-shell-profile",
        avatarNickname: REAL_SHELL_PROFILE_AUDIT_AVATAR_PROFILE.nickname,
        agenterPromptContent: REAL_SHELL_PROFILE_AUDIT_AVATAR_PROFILE.prompt,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }

        const result = await runRealShellProfileScenario(harness);

        expect(result.finalReply.chatId).toBe(primaryRoomId);
        expect(result.finalReply.content).toBe("PROFILE-CHECK-DONE");
        expect(result.rootShellValues.HOME).toBe(result.rootWorkspacePath);
        expect(result.rootShellValues.ROOT).toBe(result.rootWorkspacePath);
        expect(result.rootShellValues.HOME_DIR.length).toBeGreaterThan(0);
        expect(result.rootShellValues.PRIVATE.length).toBeGreaterThan(0);
        expect(result.terminalCreateCwd).toBe(result.rootWorkspacePath);
        expect(result.terminalValues.HOME).not.toBe(result.rootWorkspacePath);
        if (process.env.HOME) {
          expect(result.terminalValues.HOME).toBe(process.env.HOME);
        }
        expect(result.terminalValues.ROOT).toBe("");
        expect(result.terminalValues.HOME_DIR).toBe("");
        expect(result.terminalValues.PRIVATE).toBe("");
        expect(result.terminalValues.PATH.includes(result.runtimeBinDir)).toBeFalse();
        expect(result.rootBashCommands).toContain("terminal create");
        expect(result.rootBashCommands).toContain("terminal write");
        expect(result.rootBashCommands).toContain("terminal read");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.some((call) => call.outcome === "done")).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 300_000 },
  );
});
