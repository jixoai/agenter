import { describe, expect, test } from "vitest";

import type { ScopedSettingsOutput } from "@agenter/client-sdk";

import {
  parseRuntimeHeartbeatDraftNumber,
  pickEditableSettingsLayerId,
  readRuntimeHeartbeatConfigBinding,
  writeRuntimeHeartbeatConfigLayer,
} from "./runtime-heartbeat-config-state";

const graph: ScopedSettingsOutput = {
  scope: "workspace",
  effective: {
    content: "",
    value: {
      ai: {
        activeProvider: "default",
        temperature: 0.4,
        topK: 24,
        maxToken: 8192,
        thinking: {
          enabled: true,
          budgetTokens: 2048,
        },
        providers: {
          default: {
            apiStandard: "openai-chat",
            vendor: "deepseek",
            model: "deepseek-chat",
            maxContextTokens: 128000,
            pricing: {
              currency: "USD",
              bands: [
                {
                  upToTokens: 128000,
                  inputPerMillion: 0.27,
                  outputPerMillion: 1.1,
                },
              ],
            },
          },
        },
      },
    },
    schema: {},
    provenance: {},
  },
  layers: [
    {
      layerId: "workspace",
      sourceId: "project",
      kind: "file",
      path: "/repo/.agenter/settings.json",
      exists: true,
      editable: true,
    },
    {
      layerId: "avatar",
      sourceId: "user:avatar",
      kind: "avatar",
      path: "/home/tester/.agenter/avatar/default/settings.json",
      exists: true,
      editable: true,
    },
  ],
};

describe("Feature: Runtime heartbeat config state", () => {
  test("Scenario: Given numeric draft inputs arrive from the config form When parsing number fields Then both string and number bindings are accepted without trim errors", () => {
    expect(parseRuntimeHeartbeatDraftNumber(" 4096 ")).toBe(4096);
    expect(parseRuntimeHeartbeatDraftNumber(8192)).toBe(8192);
    expect(parseRuntimeHeartbeatDraftNumber("")).toBeNull();
    expect(parseRuntimeHeartbeatDraftNumber(null)).toBeNull();
    expect(parseRuntimeHeartbeatDraftNumber(Number.NaN)).toBeNull();
  });

  test("Scenario: Given runtime settings expose avatar and provider layers When picking the editable layer Then the avatar layer wins", () => {
    expect(pickEditableSettingsLayerId(graph)).toBe("avatar");
  });

  test("Scenario: Given effective ai config lives at the ai root When reading heartbeat config Then the draft mirrors ai.* instead of providers.*", () => {
    const binding = readRuntimeHeartbeatConfigBinding(graph, null);

    expect(binding.editableLayerId).toBe("avatar");
    expect(binding.activeProviderId).toBe("default");
    expect(binding.providerLabel).toBe("default · deepseek-chat");
    expect(binding.providerMetadata).toEqual({
      providerId: "default",
      model: "deepseek-chat",
      maxContextTokens: 128000,
      pricingCurrency: "USD",
      pricingBands: [
        {
          upToTokens: 128000,
          inputPerMillion: 0.27,
          cachedInputPerMillion: null,
          outputPerMillion: 1.1,
        },
      ],
    });
    expect(binding.draft).toEqual({
      temperature: 0.4,
      topK: 24,
      maxToken: 8192,
      thinkingEnabled: true,
      thinkingBudgetTokens: 2048,
    });
  });

  test("Scenario: Given the operator saves heartbeat config When writing the layer Then only ai runtime fields are updated without mutating provider defaults", () => {
    const next = writeRuntimeHeartbeatConfigLayer({
      path: "/home/tester/.agenter/avatar/default/settings.json",
      content:
        '{\n  "ai": {\n    "activeProvider": "default",\n    "providers": {\n      "default": {\n        "model": "deepseek-chat"\n      }\n    }\n  }\n}\n',
      draft: {
        temperature: 0.3,
        topK: 12,
        maxToken: 4096,
        thinkingEnabled: true,
        thinkingBudgetTokens: 1024,
      },
    });

    const parsed = JSON.parse(next) as {
      ai?: {
        activeProvider?: string;
        temperature?: number;
        topK?: number;
        maxToken?: number;
        thinking?: { enabled?: boolean; budgetTokens?: number };
        providers?: Record<string, { model?: string }>;
      };
    };

    expect(parsed.ai?.activeProvider).toBe("default");
    expect(parsed.ai?.temperature).toBe(0.3);
    expect(parsed.ai?.topK).toBe(12);
    expect(parsed.ai?.maxToken).toBe(4096);
    expect(parsed.ai?.thinking).toEqual({
      enabled: true,
      budgetTokens: 1024,
    });
    expect(parsed.ai?.providers).toEqual({
      default: {
        model: "deepseek-chat",
      },
    });
  });

  test("Scenario: Given thinking is turned off from the Heartbeat config writer When the avatar layer is saved Then the top-level ai.thinking block is removed from JSON without corrupting the document", () => {
    const next = writeRuntimeHeartbeatConfigLayer({
      path: "/home/tester/.agenter/avatar/default/settings.json",
      content:
        '{\n  "ai": {\n    "temperature": 0.4,\n    "thinking": {\n      "enabled": true,\n      "budgetTokens": 2048\n    }\n  }\n}\n',
      draft: {
        temperature: 0.4,
        topK: null,
        maxToken: null,
        thinkingEnabled: false,
        thinkingBudgetTokens: null,
      },
    });

    expect(JSON.parse(next)).toEqual({
      ai: {
        temperature: 0.4,
      },
    });
  });
});
