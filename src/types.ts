export type FactType = "USER_MSG" | "AI_THOUGHT" | "TOOL_RESULT" | "SYSTEM_EVENT";

export interface ObjectiveFact {
  id: string;
  timestamp: number;
  type: FactType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface CognitiveState {
  current_goal: string;
  plan_status: string[];
  key_facts: string[];
  last_action_result: string;
}

export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export type ActionType = "CREATE_FILE" | "READ_FILE" | "DELETE_FILE" | "DONE";

export interface ExecutorDecision {
  action: ActionType;
  reasoning: string;
  target_path: string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

export const isObjectiveFact = (value: unknown): value is ObjectiveFact => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.timestamp !== "number") return false;
  if (typeof value.type !== "string") return false;
  if (typeof value.content !== "string") return false;
  if (value.metadata !== undefined && !isRecord(value.metadata)) return false;
  return true;
};

export const isCognitiveState = (value: unknown): value is CognitiveState => {
  if (!isRecord(value)) return false;
  if (typeof value.current_goal !== "string") return false;
  if (!Array.isArray(value.plan_status) || !value.plan_status.every((v) => typeof v === "string")) {
    return false;
  }
  if (!Array.isArray(value.key_facts) || !value.key_facts.every((v) => typeof v === "string")) {
    return false;
  }
  if (typeof value.last_action_result !== "string") return false;
  return true;
};

export const isExecutorDecision = (value: unknown): value is ExecutorDecision => {
  if (!isRecord(value)) return false;
  if (typeof value.action !== "string") return false;
  if (typeof value.reasoning !== "string") return false;
  if (typeof value.target_path !== "string") return false;
  return true;
};
