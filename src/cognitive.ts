import { CognitiveState, ObjectiveFact } from "./types";
import { normalizeText } from "./utils";

const detectProgress = (facts: ObjectiveFact[]): {
  created: boolean;
  read: boolean;
  deleted: boolean;
} => {
  const textFacts = facts.map((fact) => normalizeText(fact.content));
  const created = textFacts.some((text) => text.includes("created file") || text.includes("created hello.txt"));
  const read = textFacts.some((text) => text.includes("read file") || text.includes("read hello.txt"));
  const deleted = textFacts.some((text) => text.includes("deleted file") || text.includes("deleted hello.txt"));
  return { created, read, deleted };
};

const buildPlanStatus = (progress: { created: boolean; read: boolean; deleted: boolean }): string[] => {
  const steps = [
    { label: "Create hello.txt", done: progress.created },
    { label: "Read hello.txt", done: progress.read },
    { label: "Delete hello.txt", done: progress.deleted },
  ];
  return steps.map((step) => `${step.label} (${step.done ? "done" : "todo"})`);
};

const buildCurrentGoal = (progress: { created: boolean; read: boolean; deleted: boolean }): string => {
  if (!progress.created) return "Create hello.txt";
  if (!progress.read) return "Read hello.txt";
  if (!progress.deleted) return "Delete hello.txt";
  return "All tasks completed";
};

const buildKeyFacts = (facts: ObjectiveFact[]): string[] => {
  const sorted = [...facts].sort((a, b) => a.timestamp - b.timestamp);
  const filtered = sorted.filter((fact) => fact.type === "USER_MSG" || fact.type === "TOOL_RESULT");
  return filtered.slice(-5).map((fact) => `[${fact.type}] ${fact.content}`);
};

const findLastActionResult = (facts: ObjectiveFact[]): string => {
  const lastTool = [...facts].reverse().find((fact) => fact.type === "TOOL_RESULT");
  return lastTool?.content ?? "No action yet";
};

export const deriveCognitiveState = (facts: ObjectiveFact[], trigger: string): CognitiveState => {
  void trigger;
  const progress = detectProgress(facts);
  return {
    current_goal: buildCurrentGoal(progress),
    plan_status: buildPlanStatus(progress),
    key_facts: buildKeyFacts(facts),
    last_action_result: findLastActionResult(facts),
  };
};
