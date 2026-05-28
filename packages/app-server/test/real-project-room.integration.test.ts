import { describe, expect, test } from "bun:test";

import { judgeUrlSpan } from "../src";
import {
  REAL_TEAM_BACKEND_AVATAR_PROFILE,
  REAL_TEAM_FRONTEND_AVATAR_PROFILE,
} from "../test-support/real-ai-test-personas";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealProjectRoomCollaborationScenario } from "../test-support/real-project-room-collaboration-scenario";
import { judgeMarkupExpressesConcepts } from "../test-support/real-semantic-assertions";
import { loadRequiredRealSemanticJudge } from "../test-support/real-semantic-judge";
import { createRealTeamKernelHarness, REAL_TEAM_PROJECT_ROOT } from "../test-support/real-team-kernel-harness";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_TEAM_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI multi-avatar project room collaboration", () => {
  realTest(
    "Scenario: Given a real provider When two avatars collaborate in one shared project room Then the room keeps negotiation, attachment handoff, delivery, and final acceptance as durable truth",
    async () => {
      const harness = await createRealTeamKernelHarness({
        backendAvatar: REAL_TEAM_BACKEND_AVATAR_PROFILE.nickname,
        backendPromptContent: REAL_TEAM_BACKEND_AVATAR_PROFILE.prompt,
        frontendAvatar: REAL_TEAM_FRONTEND_AVATAR_PROFILE.nickname,
        frontendPromptContent: REAL_TEAM_FRONTEND_AVATAR_PROFILE.prompt,
      });
      if (!harness) {
        throw new Error("expected real team kernel harness");
      }

      try {
        const semanticJudge = await loadRequiredRealSemanticJudge({
          projectRoot: REAL_TEAM_PROJECT_ROOT,
        });
        const result = await runRealProjectRoomCollaborationScenario(harness);
        const deliverySpan = await judgeUrlSpan(semanticJudge, result.projectUrlMessage.content);
        const acceptanceSpan = await judgeUrlSpan(semanticJudge, result.userAcceptanceMessage.content);

        expect(result.projectRoom.room.chatId).toBeTruthy();
        expect(result.backendContract.chatId).toBe(result.projectRoom.room.chatId);
        expect(result.backendContract.senderContactId).toBe(harness.backendActorId);
        expect(result.backendContract.content).toContain("BACKEND-CONTRACT:");
        expect(result.frontendPlan.chatId).toBe(result.projectRoom.room.chatId);
        expect(result.frontendPlan.senderContactId).toBe(harness.frontendActorId);
        expect(result.frontendPlan.content).toContain("FRONTEND-PLAN:");
        expect(result.apiQuestion.senderContactId).toBe(harness.frontendActorId);
        expect(result.apiQuestion.content).toContain("API-QUESTION:");
        expect(result.apiAnswer.senderContactId).toBe(harness.backendActorId);
        expect(result.apiAnswer.content).toContain("API-ANSWER:");
        expect(result.designSvg).toContain("DESIGN-SKETCH-V1");
        expect(result.designAttachmentMessage.senderContactId).toBe(harness.frontendActorId);
        expect(result.designAttachmentMessage.content).toContain("DESIGN-ATTACHMENT: design.svg");
        expect(result.designAttachmentMessage.attachments?.[0]?.assetId).toBe(result.attachedAssetId);
        expect(result.projectUrlMessage.senderContactId).toBe(harness.backendActorId);
        expect(result.projectUrlMessage.content).toContain("PROJECT-URL");
        expect(deliverySpan).not.toEqual({ start: 0, end: 0 });
        expect(result.projectUrlMessage.content.slice(deliverySpan.start, deliverySpan.end)).toBe(result.deliveryUrl);
        expect(
          await judgeMarkupExpressesConcepts(semanticJudge, {
            content: result.htmlBody,
            concepts: [
              { key: "ui_ready", concept: "team UI ready marker", aliases: ["TEAM-UI-READY"] },
              { key: "api_usage", concept: "uses /api/status endpoint", aliases: ["USES-API:/api/status"] },
              { key: "project_version", concept: "project collaboration version 1 marker", aliases: ["PROJECT-COLLAB-V1"] },
            ],
          }),
        ).toBe(true);
        expect(
          await judgeMarkupExpressesConcepts(semanticJudge, {
            content: result.apiBody,
            concepts: [
              { key: "api_ready", concept: "team API ready marker", aliases: ["TEAM-API-READY"] },
              { key: "project_version", concept: "project collaboration version 1 marker", aliases: ["PROJECT-COLLAB-V1"] },
            ],
          }),
        ).toBe(true);
        expect(result.userAcceptanceMessage.senderContactId).toBe(harness.userActorId);
        expect(acceptanceSpan).not.toEqual({ start: 0, end: 0 });
        expect(result.userAcceptanceMessage.content.slice(acceptanceSpan.start, acceptanceSpan.end)).toBe(
          result.deliveryUrl,
        );
        expect(Array.isArray(result.backendAttention.active)).toBe(true);
        expect(Array.isArray(result.frontendAttention.active)).toBe(true);
        expect(result.backendModelCalls.some((call) => call.tools.includes("root_bash"))).toBe(true);
        expect(result.frontendModelCalls.some((call) => call.tools.includes("root_bash"))).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 960_000 },
  );
});
