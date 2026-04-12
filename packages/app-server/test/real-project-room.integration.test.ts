import { describe, expect, test } from "bun:test";

import { judgeUrlSpan } from "../src";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealProjectRoomCollaborationScenario } from "../test-support/real-project-room-collaboration-scenario";
import { loadRealSemanticJudgeOrWarn } from "../test-support/real-semantic-judge";
import { createRealTeamKernelHarness, REAL_TEAM_PROJECT_ROOT } from "../test-support/real-team-kernel-harness";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_TEAM_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI multi-avatar project room collaboration", () => {
  realTest(
    "Scenario: Given a real provider When two avatars collaborate in one shared project room Then the room keeps negotiation, attachment handoff, delivery, and final acceptance as durable truth",
    async () => {
      const harness = await createRealTeamKernelHarness();
      if (!harness) {
        throw new Error("expected real team kernel harness");
      }

      try {
        const semanticJudge = await loadRealSemanticJudgeOrWarn({
          projectRoot: REAL_TEAM_PROJECT_ROOT,
        });
        if (!semanticJudge) {
          return;
        }
        const result = await runRealProjectRoomCollaborationScenario(harness);
        const deliverySpan = await judgeUrlSpan(semanticJudge, result.projectUrlMessage.content);
        const acceptanceSpan = await judgeUrlSpan(semanticJudge, result.userAcceptanceMessage.content);

        expect(result.projectRoom.room.chatId).toBeTruthy();
        expect(result.backendContract.chatId).toBe(result.projectRoom.room.chatId);
        expect(result.backendContract.senderActorId).toBe(harness.backendActorId);
        expect(result.backendContract.content).toContain("BACKEND-CONTRACT:");
        expect(result.frontendPlan.chatId).toBe(result.projectRoom.room.chatId);
        expect(result.frontendPlan.senderActorId).toBe(harness.frontendActorId);
        expect(result.frontendPlan.content).toContain("FRONTEND-PLAN:");
        expect(result.apiQuestion.senderActorId).toBe(harness.frontendActorId);
        expect(result.apiQuestion.content).toContain("API-QUESTION:");
        expect(result.apiAnswer.senderActorId).toBe(harness.backendActorId);
        expect(result.apiAnswer.content).toContain("API-ANSWER:");
        expect(result.designSvg).toContain("DESIGN-SKETCH-V1");
        expect(result.designAttachmentMessage.senderActorId).toBe(harness.frontendActorId);
        expect(result.designAttachmentMessage.content).toContain("DESIGN-ATTACHMENT: design.svg");
        expect(result.designAttachmentMessage.attachments?.[0]?.assetId).toBe(result.attachedAssetId);
        expect(result.projectUrlMessage.senderActorId).toBe(harness.backendActorId);
        expect(result.projectUrlMessage.content).toContain("PROJECT-URL");
        expect(deliverySpan).not.toEqual({ start: 0, end: 0 });
        expect(result.projectUrlMessage.content.slice(deliverySpan.start, deliverySpan.end)).toBe(result.deliveryUrl);
        expect(result.htmlBody).toContain("TEAM-UI-READY");
        expect(result.htmlBody).toContain("USES-API:/api/status");
        expect(result.htmlBody).toContain("PROJECT-COLLAB-V1");
        expect(result.apiBody).toContain("TEAM-API-READY");
        expect(result.apiBody).toContain("PROJECT-COLLAB-V1");
        expect(result.userAcceptanceMessage.senderActorId).toBe(harness.userActorId);
        expect(acceptanceSpan).not.toEqual({ start: 0, end: 0 });
        expect(result.userAcceptanceMessage.content.slice(acceptanceSpan.start, acceptanceSpan.end)).toBe(
          result.deliveryUrl,
        );
        expect(Array.isArray(result.backendAttention.active)).toBe(true);
        expect(Array.isArray(result.frontendAttention.active)).toBe(true);
        expect(result.backendModelCalls.some((call) => call.tools.includes("root_workspace_bash"))).toBe(true);
        expect(result.frontendModelCalls.some((call) => call.tools.includes("root_workspace_bash"))).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 960_000 },
  );
});
