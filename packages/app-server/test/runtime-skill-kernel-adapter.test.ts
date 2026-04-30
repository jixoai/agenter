import { describe, expect, test } from "bun:test";

import { AttentionSystem } from "@agenter/attention-system";

import type { RuntimeSkillRefreshResult } from "../src/runtime-skill-system";
import { RuntimeSkillKernelAdapter } from "../src/runtime-system-kernel-adapters/skill-adapter";
import type { RuntimeSystemKernelHost } from "../src/runtime-system-kernel-adapters/types";

const RUNTIME_SKILL_PUBLISH_CONTEXT_ID = "ctx-workspace-runtime";

const createSkillHost = (attention: AttentionSystem): RuntimeSystemKernelHost => ({
  registerCommitRef: (input) => ({ ...input, createdAt: 1 }),
  getDeliveryProjection: () => null,
  listDeliveryProjections: () => [],
  queryAttentionDeliveryTimeline: () => ({ dispatches: [], receipts: [] }),
  signalIngress: () => {},
  commitIngress: async (envelope) => {
    attention.getContext(envelope.contextKey) ??
      attention.createContext({
        contextId: envelope.contextKey,
        owner: envelope.author,
        focusState: "background",
      });
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
  test("Scenario: Given ordinary published skill ingress When the adapter applies it Then commits flow through the shared host contract", async () => {
    const attention = new AttentionSystem();
    const adapter = new RuntimeSkillKernelAdapter();
    adapter.mount(createSkillHost(attention));

    const result: RuntimeSkillRefreshResult = {
      skills: [],
      snapshot: "## skills.list",
      changedSkills: [],
      publishedIngresses: [
        {
          system: "skill",
          boundaryChannel: "capability_projection",
          sourceId: "skill:runtime:snapshot",
          contextKey: RUNTIME_SKILL_PUBLISH_CONTEXT_ID,
          kind: "runtime_skill_snapshot",
          summary: "Refreshed runtime skill snapshot.",
          content: "## skills.list",
          format: "text/markdown",
          score: 0,
          tags: ["skill", "snapshot"],
          createdAt: 1,
          author: "avatar",
          commitMode: "system",
        },
        {
          system: "skill",
          boundaryChannel: "world_fact",
          sourceId: "skill:runtime:change:updated:live-sync:1:0",
          contextKey: RUNTIME_SKILL_PUBLISH_CONTEXT_ID,
          kind: "runtime_skill_change",
          summary: "Updated runtime skill live-sync.",
          content: "",
          format: "text/plain",
          score: 100,
          tags: ["notification", "skill-change", "updated"],
          createdAt: 1,
          author: "avatar",
          changeType: "diff",
        },
      ],
    };

    const applied = await adapter.applyRefreshResult(result, { notifyLoop: true });
    const context = attention.getContext(RUNTIME_SKILL_PUBLISH_CONTEXT_ID);

    expect(applied.commitIds).toHaveLength(2);
    expect(context).toBeDefined();
    expect(context?.getState().focusState).toBe("background");
    expect(context?.listRecentCommits().map((commit) => commit.summary)).toEqual([
      "Refreshed runtime skill snapshot.",
      "Updated runtime skill live-sync.",
    ]);
  });
});
