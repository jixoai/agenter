import { describe, expect, test } from "bun:test";

import { AttentionSystem } from "@agenter/attention-system";

import {
  RUNTIME_SKILL_CONTEXT_ID,
  RUNTIME_SKILL_CONTEXT_TEMPLATE,
  RUNTIME_SKILL_DEFAULT_TARGET,
  RUNTIME_SKILL_SNAPSHOT_TARGET,
  type RuntimeSkillRefreshResult,
} from "../src/runtime-skill-system";
import { RuntimeSkillKernelAdapter } from "../src/runtime-system-kernel-adapters/skill-adapter";
import type { RuntimeSystemIngressEnvelope, RuntimeSystemKernelHost } from "../src/runtime-system-kernel-adapters/types";

const createSkillHost = (attention: AttentionSystem): RuntimeSystemKernelHost => ({
  registerCommitRef: (input) => ({ ...input, createdAt: 1 }),
  getDeliveryProjection: () => null,
  listDeliveryProjections: () => [],
  queryAttentionDeliveryTimeline: () => ({ dispatches: [], receipts: [] }),
  signalIngress: () => {},
  commitIngress: async (envelope) => {
    if (!attention.getContext(envelope.contextKey)) {
      throw new Error(`missing context: ${envelope.contextKey}`);
    }
    const action =
      envelope.commitMode === "system" ? attention.commitSystem.bind(attention) : attention.commit.bind(attention);
    const { commit } = action(envelope.contextKey, {
      target: envelope.target,
      ingressType: envelope.ingressType,
      meta: {
        author: envelope.author,
        source: envelope.system,
        src: envelope.sourceId,
        tags: envelope.tags,
        createdAt: new Date(envelope.createdAt).toISOString(),
      },
      scores: envelope.score ? { seed: envelope.score } : {},
      summary: envelope.summary,
      change: {
        type: envelope.changeType ?? "update",
        value: envelope.content,
        format: envelope.format,
      },
    });
    return {
      contextId: envelope.contextKey,
      commit,
    };
  },
});

describe("Feature: runtime-skill-kernel-adapter", () => {
  test("Scenario: Given a skill refresh result When the adapter applies it Then snapshot and reminders commit through the host API and bootstrap stays consumable", async () => {
    const attention = new AttentionSystem();
    const ensureAttentionContext = () => {
      if (!attention.getContext(RUNTIME_SKILL_CONTEXT_ID)) {
        attention.createContext({
          contextId: RUNTIME_SKILL_CONTEXT_ID,
          owner: "avatar",
          focusState: "background",
          template: RUNTIME_SKILL_CONTEXT_TEMPLATE,
          slots: {
            [RUNTIME_SKILL_DEFAULT_TARGET]: "",
            [RUNTIME_SKILL_SNAPSHOT_TARGET]: "",
          },
        });
      }
    };
    const adapter = new RuntimeSkillKernelAdapter({
      ensureAttentionContext,
      getBootstrapContext: () => {
        const context = attention.getContext(RUNTIME_SKILL_CONTEXT_ID);
        return context
          ? {
              contextId: RUNTIME_SKILL_CONTEXT_ID,
              context: context.getState(),
              recentCommits: context.listRecentCommits(),
            }
          : null;
      },
    });
    adapter.mount(createSkillHost(attention));

    const result: RuntimeSkillRefreshResult = {
      contextId: RUNTIME_SKILL_CONTEXT_ID,
      skills: [],
      snapshot: "## skills.list",
      changedSkills: [],
      systemIngress: {
        system: "skill",
        sourceId: "skill:runtime:snapshot",
        contextKey: RUNTIME_SKILL_CONTEXT_ID,
        kind: "runtime_skill_snapshot",
        summary: "Refreshed runtime skill snapshot.",
        content: "## skills.list",
        format: "text/markdown",
        score: 0,
        tags: ["skill", "snapshot"],
        createdAt: 1,
        author: "avatar",
        target: RUNTIME_SKILL_SNAPSHOT_TARGET,
        commitMode: "system",
      },
      reminderIngresses: [
        {
          system: "skill",
          sourceId: "skill:runtime:change:updated:live-sync:1:0",
          contextKey: RUNTIME_SKILL_CONTEXT_ID,
          kind: "runtime_skill_change",
          summary: "Updated runtime skill live-sync.",
          content: "",
          format: "text/plain",
          score: 100,
          tags: ["notification", "skill-change", "updated"],
          createdAt: 1,
          author: "avatar",
          target: RUNTIME_SKILL_DEFAULT_TARGET,
          changeType: "diff",
        },
      ],
      bootstrapPending: true,
    };

    const applied = await adapter.applyRefreshResult(result, { notifyLoop: true });
    const bootstrap = adapter.consumeBootstrapContext();

    expect(applied.systemCommitId).not.toBeNull();
    expect(applied.reminderCommitIds).toHaveLength(1);
    expect(applied.bootstrapPending).toBeTrue();
    expect(bootstrap?.contextId).toBe(RUNTIME_SKILL_CONTEXT_ID);
    expect(bootstrap?.context.content).toContain("## skills.list");
    expect(adapter.consumeBootstrapContext()).toBeNull();
  });
});
