import { describe, expect, test } from "bun:test";

import { judgeUrlSpan } from "../src";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealProjectRoomRealisticUserScenario } from "../test-support/real-project-room-realistic-user-scenario";
import { judgeMarkupExpressesConcepts } from "../test-support/real-semantic-assertions";
import { loadRequiredRealSemanticJudge } from "../test-support/real-semantic-judge";
import { createRealTeamKernelHarness, REAL_TEAM_PROJECT_ROOT } from "../test-support/real-team-kernel-harness";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_TEAM_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI realistic project-room collaboration", () => {
  realTest(
    "Scenario: Given a real provider When one ordinary user asks two specialized avatars for a tiny project Then they coordinate in-room, hand off a design attachment, and deliver a working URL",
    async () => {
      const harness = await createRealTeamKernelHarness();
      if (!harness) {
        throw new Error("expected real team kernel harness");
      }

      try {
        const semanticJudge = await loadRequiredRealSemanticJudge({
          projectRoot: REAL_TEAM_PROJECT_ROOT,
        });
        const result = await runRealProjectRoomRealisticUserScenario(harness);
        const finalUrlSpan = await judgeUrlSpan(semanticJudge, result.finalUrlMessage.content);

        expect(result.projectRoom.room.chatId).toBeTruthy();
        expect(result.frontendCoordinationMessage.senderActorId).toBe(harness.frontendActorId);
        expect(result.backendCoordinationMessage.senderActorId).toBe(harness.backendActorId);
        if (result.apiQuestionMessage) {
          expect(result.apiQuestionMessage.senderActorId).toBe(harness.frontendActorId);
          expect(result.apiQuestionMessage.content).toContain("/api/status");
        }
        expect(result.apiAnswerMessage.senderActorId).toBe(harness.backendActorId);
        expect(/\/api\/status|READY-API|PROJECT-BOARD-V1/iu.test(result.apiAnswerMessage.content)).toBe(true);
        expect(result.designSvg).toContain("<svg");
        expect(
          await judgeMarkupExpressesConcepts(semanticJudge, {
            content: result.designSvg,
            concepts: [{ key: "board_title", concept: "team project board title", aliases: ["小队项目看板"] }],
          }),
        ).toBe(true);
        expect(result.designAttachmentMessage.senderActorId).toBe(harness.frontendActorId);
        expect(result.designAttachmentMessage.attachments?.[0]?.assetId).toBe(result.attachedAssetId);
        expect(result.finalUrlMessage.senderActorId).toBe(harness.backendActorId);
        expect(finalUrlSpan).not.toEqual({ start: 0, end: 0 });
        expect(result.finalUrlMessage.content.slice(finalUrlSpan.start, finalUrlSpan.end)).toBe(result.deliveryUrl);
        expect(
          await judgeMarkupExpressesConcepts(semanticJudge, {
            content: result.htmlBody,
            concepts: [
              { key: "board_title", concept: "team project board title", aliases: ["小队项目看板"] },
              { key: "api_status", concept: "API status section", aliases: ["接口状态"] },
              { key: "ready_state", concept: "ready status copy", aliases: ["准备好了"] },
            ],
          }),
        ).toBe(true);
        expect(
          await judgeMarkupExpressesConcepts(semanticJudge, {
            content: result.apiBody,
            concepts: [
              { key: "api_ready", concept: "ready API marker", aliases: ["READY-API"] },
              { key: "project_version", concept: "project board version 1 marker", aliases: ["PROJECT-BOARD-V1"] },
            ],
          }),
        ).toBe(true);
        expect(result.userAcceptanceMessage.senderActorId).toBe(harness.userActorId);
        expect(result.backendAttention.active).toHaveLength(0);
        expect(result.frontendAttention.active).toHaveLength(0);
        expect(result.backendModelCalls.some((call) => call.tools.includes("root_workspace_bash"))).toBe(true);
        expect(result.frontendModelCalls.some((call) => call.tools.includes("root_workspace_bash"))).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 720_000 },
  );
});
