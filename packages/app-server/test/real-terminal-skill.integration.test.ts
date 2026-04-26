import { describe, expect, test } from "bun:test";

import { REAL_ROOM_TERMINAL_AVATAR_PROFILE } from "../test-support/real-ai-test-personas";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealTerminalSkillLearningScenario } from "../test-support/real-loopbus-scenarios";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

const TERMINAL_SKILL_PROMPT = [
  REAL_ROOM_TERMINAL_AVATAR_PROFILE.prompt.trim(),
  "- In this audit, you must inspect `agenter-terminal` through `root_bash` before your first terminal lifecycle command.",
  "- After reading the skill, apply its lifecycle law directly: inspect terminal status, stop explicitly, bootstrap explicitly, then use terminal CLI for the real work.",
  "- Do not fake terminal lifecycle understanding from memory. Learn it from the skill or command help, then execute it.",
].join("\n");

describe("Feature: real AI terminal skill learning", () => {
  realTest(
    "Scenario: Given a real provider When the task explicitly requires reading agenter-terminal first Then the assistant learns terminal lifecycle commands from the skill and completes the workflow",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-terminal-skill-learning",
        avatarNickname: "test-terminal-skill-learning",
        agenterPromptContent: TERMINAL_SKILL_PROMPT,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const result = await runRealTerminalSkillLearningScenario(harness);
        const commands = result.rootWorkspaceBashCommands;
        const firstSkillInfoIndex = commands.findIndex((command) => command.includes("skill info agenter-terminal"));
        const firstTerminalLifecycleIndex = commands.findIndex((command) =>
          /\bterminal (create|list|stop|bootstrap|write|input|read)\b/u.test(command),
        );

        expect(result.reply.chatId).toBe(primaryRoomId);
        expect(result.reply.content.trim()).toBe("TERMINAL-SKILL-OK");
        expect(result.proofText).toBe("TERMINAL-SKILL-OK");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
        expect(result.recentModelCalls.some((call) => call.outcome === "done")).toBe(true);
        expect(result.toolTraceTools).toContain("root_bash");
        expect(firstSkillInfoIndex).toBeGreaterThanOrEqual(0);
        expect(firstTerminalLifecycleIndex).toBeGreaterThanOrEqual(0);
        expect(firstSkillInfoIndex).toBeLessThan(firstTerminalLifecycleIndex);
        expect(commands.some((command) => /\bterminal create\b/u.test(command))).toBe(true);
        expect(commands.some((command) => /\bterminal list\b/u.test(command))).toBe(true);
        expect(commands.some((command) => /\bterminal stop\b/u.test(command))).toBe(true);
        expect(commands.some((command) => /\bterminal bootstrap\b/u.test(command))).toBe(true);
        expect(commands.some((command) => /\bterminal (write|input)\b/u.test(command))).toBe(true);
        expect(
          commands.some(
            (command) => command.includes("terminal-skill-proof.txt") && /\bcat\b/u.test(command),
          ),
        ).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 420_000 },
  );
});
