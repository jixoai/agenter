import { describe, expect, test } from "bun:test";

import {
  isSingleSourceApiAnswer,
  isSingleSourceApiQuestion,
} from "../test-support/real-project-room-collaboration-scenario";
import { isRealisticBackendApiAnswerContent } from "../test-support/real-project-room-realistic-user-scenario";

describe("Feature: real project room collaboration guards", () => {
  test("Scenario: Given a frontend asks for the final API contract When it only requests fields and meanings Then the single-source guard accepts it", () => {
    expect(
      isSingleSourceApiQuestion(
        [
          "API-QUESTION:",
          "backend，请给出 GET /api/status 的最终响应契约：",
          "返回的 JSON 包含哪些字段、每个字段的类型和含义？",
        ].join("\n"),
      ),
    ).toBe(true);
  });

  test("Scenario: Given a frontend guesses a payload example When it publishes JSON-like field values Then the single-source guard rejects it", () => {
    expect(
      isSingleSourceApiQuestion(
        [
          "API-QUESTION:",
          "我假设 GET /api/status 的最终契约可能是：",
          "{",
          '  "status": "ok",',
          '  "version": "draft"',
          "}",
        ].join("\n"),
      ),
    ).toBe(false);
  });

  test("Scenario: Given a backend bans extra fields in prose When it says there is no uptime field Then the single-source answer guard still accepts the contract", () => {
    expect(
      isSingleSourceApiAnswer(
        [
          "API-ANSWER:",
          "GET /api/status",
          '- status: "TEAM-API-READY"',
          '- version: "PROJECT-COLLAB-V1"',
          "- timestamp: new Date().toISOString()",
          "frontend 使用相对路径 /api/status 即可。",
          "无其它字段，无 uptime，无完整 URL 或端口。",
        ].join("\n"),
      ),
    ).toBe(true);
  });

  test("Scenario: Given a backend adds uptime as a real field When the contract contains an extra uptime entry Then the single-source answer guard rejects it", () => {
    expect(
      isSingleSourceApiAnswer(
        [
          "API-ANSWER:",
          "GET /api/status",
          '- status: "TEAM-API-READY"',
          '- version: "PROJECT-COLLAB-V1"',
          "- timestamp: new Date().toISOString()",
          "- uptime: 12",
        ].join("\n"),
      ),
    ).toBe(false);
  });

  test("Scenario: Given a backend uses natural final-delivery wording When it names /api/status plus exact tokens Then the realistic-user API-answer guard accepts it", () => {
    expect(
      isRealisticBackendApiAnswerContent(
        [
          "全部就绪，请打开 http://127.0.0.1:50843/ 查看。",
          "- 页面展示“小队项目看板”、“接口状态”、“准备好了”",
          "- /api/status 返回 READY-API 和 PROJECT-BOARD-V1",
          "- design.svg 已在共享目录",
        ].join("\n"),
      ),
    ).toBe(true);
  });
});
