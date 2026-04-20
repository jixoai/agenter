import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import type { ScopedSettingsOutput } from "@agenter/client-sdk";

import {
  parseRuntimeSettingsPolicyNumber,
  parseRuntimeSettingsPolicyText,
  readRuntimeSettingsPolicyBinding,
  writeRuntimeSettingsPolicyLayer,
} from "./runtime-settings-policy-state";

const runtimeSettingsPolicyStateSource = readFileSync(
  resolve(import.meta.dirname, "runtime-settings-policy-state.ts"),
  "utf8",
);

const graph = {
  scope: "workspace",
  effective: {
    content: "",
    value: {
      lang: "zh-Hans",
      prompt: {
        rootDir: "/repo/.agenter/prompts",
        agenterPath: "/repo/.agenter/prompts/AGENTER.mdx",
        internalSystemPath: "/repo/.agenter/prompts/AGENTER_SYSTEM.mdx",
        systemTemplatePath: "/repo/.agenter/prompts/SYSTEM_TEMPLATE.mdx",
        responseContractPath: "/repo/.agenter/prompts/RESPONSE_CONTRACT.mdx",
      },
      ai: {
        activeProvider: "default",
        providers: {
          default: {
            apiStandard: "openai-chat",
            vendor: "deepseek",
            model: "deepseek-chat",
            maxRetries: 2,
            compactThreshold: 0.75,
          },
        },
      },
      loop: {
        retryPolicy: {
          mode: "exponential",
          maxAttempts: 4,
          initialBackoffMs: 1200,
          multiplier: 2.5,
          maxBackoffMs: 15000,
          resetOnExternalInput: true,
          resetOnProgress: false,
        },
        compactPolicy: {
          threshold: {
            enabled: true,
            promptFraction: 0.82,
          },
          recovery: {
            attentionRetry: true,
            contextOverflow: true,
            externalContinuationLimit: false,
            timeout: false,
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
} satisfies ScopedSettingsOutput;

describe("Feature: Runtime settings policy state", () => {
  test("Scenario: Given runtime policy state runs in the browser When reading the source Then it imports defaults from the browser-safe runtime-policy entry instead of the settings root barrel", () => {
    expect(runtimeSettingsPolicyStateSource).toContain('from "@agenter/settings/runtime-policy";');
    expect(runtimeSettingsPolicyStateSource).not.toContain('from "@agenter/settings";');
  });

  test("Scenario: Given runtime policies live under loop and prompt fields live at the root When reading the runtime policy binding Then the editor sees four durable sections instead of provider-coupled heuristics", () => {
    const binding = readRuntimeSettingsPolicyBinding(graph);

    expect(binding.editableLayerId).toBe("avatar");
    expect(binding.providerLabel).toBe("default · deepseek-chat");
    expect(binding.draft).toMatchObject({
      transportMaxRetries: 2,
      compactThresholdEnabled: true,
      compactThresholdPromptFraction: 0.82,
      compactOnAttentionRetry: true,
      compactOnContextOverflow: true,
      compactOnExternalContinuationLimit: false,
      compactOnTimeout: false,
      retryMaxAttempts: 4,
      retryInitialBackoffMs: 1200,
      retryMultiplier: 2.5,
      retryMaxBackoffMs: 15000,
      retryResetOnExternalInput: true,
      retryResetOnProgress: false,
      lang: "zh-Hans",
      promptRootDir: "/repo/.agenter/prompts",
      promptAgenterPath: "/repo/.agenter/prompts/AGENTER.mdx",
      promptAgenterSystemPath: "/repo/.agenter/prompts/AGENTER_SYSTEM.mdx",
      promptSystemTemplatePath: "/repo/.agenter/prompts/SYSTEM_TEMPLATE.mdx",
      promptResponseContractPath: "/repo/.agenter/prompts/RESPONSE_CONTRACT.mdx",
    });
  });

  test("Scenario: Given loop compact policy is absent but legacy provider compactThreshold remains When reading the runtime policy binding Then the editor projects the legacy threshold into the durable compact surface", () => {
    const binding = readRuntimeSettingsPolicyBinding({
      ...graph,
      effective: {
        ...graph.effective,
        value: {
          ...graph.effective.value,
          ai: {
            ...graph.effective.value.ai,
            providers: {
              ...graph.effective.value.ai.providers,
              default: {
                ...graph.effective.value.ai.providers.default,
                compactThreshold: 0.91,
              },
            },
          },
          loop: {
            retryPolicy: graph.effective.value.loop.retryPolicy,
          },
        },
      },
    });

    expect(binding.draft.compactThresholdEnabled).toBe(true);
    expect(binding.draft.compactThresholdPromptFraction).toBe(0.91);
  });

  test("Scenario: Given policy form inputs arrive as strings When parsing runtime policy values Then blanks collapse to null and trimmed text survives", () => {
    expect(parseRuntimeSettingsPolicyNumber(" 4096 ")).toBe(4096);
    expect(parseRuntimeSettingsPolicyNumber("")).toBeNull();
    expect(parseRuntimeSettingsPolicyText("  zh-Hans  ")).toBe("zh-Hans");
    expect(parseRuntimeSettingsPolicyText("   ")).toBeNull();
  });

  test("Scenario: Given the operator saves runtime policy fields When writing the editable layer Then loop policies are updated and legacy provider compactThreshold is removed", () => {
    const next = writeRuntimeSettingsPolicyLayer({
      path: "/home/tester/.agenter/avatar/default/settings.json",
      content:
        '{\n  "ai": {\n    "activeProvider": "default",\n    "providers": {\n      "default": {\n        "model": "deepseek-chat",\n        "compactThreshold": 0.75\n      }\n    }\n  }\n}\n',
      activeProviderId: "default",
      draft: {
        transportMaxRetries: 3,
        compactThresholdEnabled: true,
        compactThresholdPromptFraction: 0.9,
        compactOnAttentionRetry: true,
        compactOnContextOverflow: true,
        compactOnExternalContinuationLimit: true,
        compactOnTimeout: false,
        retryMaxAttempts: 5,
        retryInitialBackoffMs: 800,
        retryMultiplier: 1.8,
        retryMaxBackoffMs: 12000,
        retryResetOnExternalInput: true,
        retryResetOnProgress: true,
        lang: "en",
        promptRootDir: "/runtime/prompts",
        promptAgenterPath: "/runtime/prompts/AGENTER.mdx",
        promptAgenterSystemPath: "/runtime/prompts/AGENTER_SYSTEM.mdx",
        promptSystemTemplatePath: "/runtime/prompts/SYSTEM_TEMPLATE.mdx",
        promptResponseContractPath: "/runtime/prompts/RESPONSE_CONTRACT.mdx",
      },
    });

    const parsed = JSON.parse(next) as {
      ai?: {
        providers?: Record<string, { maxRetries?: number; compactThreshold?: number }>;
      };
      loop?: {
        retryPolicy?: Record<string, unknown>;
        compactPolicy?: {
          threshold?: Record<string, unknown>;
          recovery?: Record<string, unknown>;
        };
      };
      lang?: string;
      prompt?: Record<string, unknown>;
    };

    expect(parsed.ai?.providers?.default).toMatchObject({
      maxRetries: 3,
    });
    expect(parsed.loop?.retryPolicy).toEqual({
      maxAttempts: 5,
      initialBackoffMs: 800,
      multiplier: 1.8,
      maxBackoffMs: 12000,
      resetOnExternalInput: true,
      resetOnProgress: true,
    });
    expect(parsed.loop?.compactPolicy).toEqual({
      threshold: {
        enabled: true,
        promptFraction: 0.9,
      },
      recovery: {
        attentionRetry: true,
        contextOverflow: true,
        externalContinuationLimit: true,
        timeout: false,
      },
    });
    expect(parsed.lang).toBe("en");
    expect(parsed.prompt).toMatchObject({
      rootDir: "/runtime/prompts",
      agenterPath: "/runtime/prompts/AGENTER.mdx",
      internalSystemPath: "/runtime/prompts/AGENTER_SYSTEM.mdx",
      systemTemplatePath: "/runtime/prompts/SYSTEM_TEMPLATE.mdx",
      responseContractPath: "/runtime/prompts/RESPONSE_CONTRACT.mdx",
    });
  });
});
