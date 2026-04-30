import { summarizeRuntimeSkillChange, type RuntimeSkillChange } from "./runtime-skill-diff";
import type { RuntimeSystemIngressEnvelope } from "./runtime-system-kernel-adapters/types";

export const buildRuntimeSkillSnapshotIngress = (input: {
  owner: string;
  contextId: string;
  snapshot: string;
  createdAt: number;
}): RuntimeSystemIngressEnvelope => ({
  system: "skill",
  boundaryChannel: "capability_projection",
  sourceId: "skill:runtime:snapshot",
  contextKey: input.contextId,
  kind: "runtime_skill_snapshot",
  summary: "Refreshed runtime skill snapshot.",
  content: input.snapshot,
  format: "text/markdown",
  score: 0,
  tags: ["skill", "snapshot"],
  createdAt: input.createdAt,
  author: input.owner,
  commitMode: "system",
});

export const buildRuntimeSkillChangeIngresses = (input: {
  owner: string;
  contextId: string;
  scoreKey: string;
  changes: RuntimeSkillChange[];
  createdAt: number;
}): RuntimeSystemIngressEnvelope[] =>
  input.changes.map((change, index) => ({
    system: "skill",
    boundaryChannel: "world_fact",
    sourceId: `skill:runtime:change:${change.kind}:${change.name}:${input.createdAt}:${index}`,
    contextKey: input.contextId,
    kind: "runtime_skill_change",
    summary: summarizeRuntimeSkillChange(change),
    content: "",
    format: "text/plain",
    score: 100,
    tags: ["notification", "skill-change", change.kind],
    createdAt: input.createdAt,
    author: input.owner,
    commitMode: "commit" as const,
    changeType: "diff" as const,
    meta: {
      name: change.name,
      rootKind: change.rootKind,
      changedFiles: [...change.changedFiles],
      scoreKey: input.scoreKey,
    },
  }));
