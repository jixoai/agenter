import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { SessionDb } from "@agenter/session-system";

import { createMockKernelHarness } from "../test-support/mock-kernel-harness";
import { createGaubeeRoom, runTwoRoomRelayScenario } from "../test-support/mock-loopbus-scenarios";

const EXPECTED_DIRECT_TOOL_NAMES = ["workspace_list", "root_bash", "workspace_bash"] as const;

const readDirectToolNames = (requestBody: unknown): string[] => {
  if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody)) {
    return [];
  }
  const tools = (requestBody as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) {
    return [];
  }
  return tools.flatMap((tool) => {
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
      return [];
    }
    const directName =
      "name" in tool && typeof tool.name === "string"
        ? tool.name
        : null;
    if (directName) {
      return [directName];
    }
    const functionRecord =
      "function" in tool && tool.function && typeof tool.function === "object" && !Array.isArray(tool.function)
        ? (tool.function as { name?: unknown })
        : null;
    return typeof functionRecord?.name === "string" ? [functionRecord.name] : [];
  });
};

const readTraceToolNames = (responseBody: unknown): string[] => {
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return [];
  }
  const response =
    "response" in responseBody && responseBody.response && typeof responseBody.response === "object"
      ? (responseBody.response as { toolTrace?: unknown })
      : null;
  if (!Array.isArray(response?.toolTrace)) {
    return [];
  }
  return response.toolTrace.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    return typeof entry.tool === "string" ? [entry.tool] : [];
  });
};

describe("Feature: workspace direct tool request-body contract", () => {
  test(
    "Scenario: Given persisted ai_call facts When a mock loop completes Then requestBody keeps only workspace_list root_bash workspace_bash and tool traces keep the new shell names",
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "workspace-tool-request-body" });
      let db: SessionDb | null = null;

      try {
        const relayChannel = await createGaubeeRoom(harness);
        await runTwoRoomRelayScenario(harness, relayChannel);
        db = new SessionDb(join(harness.session.sessionRoot, "session.db"));

        const persistedCalls = db.listAiCalls(8);
        expect(persistedCalls.length).toBeGreaterThan(0);

        for (const call of persistedCalls) {
          const toolNames = readDirectToolNames(call.requestBody);
          expect(toolNames).toEqual([...EXPECTED_DIRECT_TOOL_NAMES]);
          expect(toolNames.some((name) => /^(attention_|message_|terminal_|skill_|tool_)/u.test(name))).toBeFalse();
        }

        const traceToolNames = persistedCalls.flatMap((call) => readTraceToolNames(call.responseBody));
        expect(traceToolNames).toContain("root_bash");
        expect(
          traceToolNames.every((name) => EXPECTED_DIRECT_TOOL_NAMES.includes(name as (typeof EXPECTED_DIRECT_TOOL_NAMES)[number])),
        ).toBeTrue();

        const debug = await harness.kernel.inspectModelDebug(harness.session.id);
        expect(debug.recentModelCalls).toHaveLength(persistedCalls.length);
        expect(debug.recentModelCalls.at(-1)?.request).toEqual(persistedCalls.at(-1)?.requestBody);
      } finally {
        db?.close();
        await harness.stop();
      }
    },
    { timeout: 30_000 },
  );
});
