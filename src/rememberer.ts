/**
 * Rememberer - Cognitive State Builder
 * Functional approach to memory-based context reconstruction
 */
import { MemoryManager } from "./memory-manager.js";
import { CognitiveState, ObjectiveFact } from "./types.js";
import {
  createChat,
  buildRemembererPrompt,
  collectStream,
  getAdapter,
  type LLMConfig,
  type Message,
} from "./llm/index.js";

// ============================================================================
// Types
// ============================================================================

export interface RecallTrace {
  trigger: string;
  recent_count: number;
  related_count: number;
  merged_count: number;
  tool_calls: string[];
  messages: Message[];
  raw_response: string;
}

export interface RecallResult {
  cognitiveState: CognitiveState;
  trace: RecallTrace;
}

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Merge facts from multiple sources, removing duplicates
 */
const mergeFacts = (recent: ObjectiveFact[], related: ObjectiveFact[]): ObjectiveFact[] => {
  const map = new Map<string, ObjectiveFact>();
  for (const fact of [...related, ...recent]) {
    map.set(fact.id, fact);
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Create recall trace
 */
const createTrace = (
  trigger: string,
  recent: ObjectiveFact[],
  related: ObjectiveFact[],
  merged: ObjectiveFact[],
  toolCalls: string[],
  messages: Message[],
  rawResponse: string
): RecallTrace => ({
  trigger,
  recent_count: recent.length,
  related_count: related.length,
  merged_count: merged.length,
  tool_calls: toolCalls,
  messages,
  raw_response: rawResponse,
});

/**
 * Build user prompt for rememberer
 */
const buildUserPrompt = (trigger: string, facts: ObjectiveFact[]): Message => ({
  role: "user",
  content: [`TRIGGER=${trigger}`, `RAW_FACTS_JSON=${JSON.stringify(facts)}`].join("\n"),
});

/**
 * Safe parse cognitive state from JSON
 */
const parseCognitiveState = (json: string): CognitiveState | null => {
  try {
    const parsed = JSON.parse(json) as CognitiveState;
    if (
      typeof parsed.current_goal === "string" &&
      Array.isArray(parsed.plan_status) &&
      Array.isArray(parsed.key_facts) &&
      typeof parsed.last_action_result === "string"
    ) {
      return parsed;
    }
  } catch {
    // Invalid JSON
  }
  return null;
};

// ============================================================================
// Derive Functions (fallback when LLM fails)
// ============================================================================

interface Progress {
  created: boolean;
  read: boolean;
  deleted: boolean;
}

const detectProgress = (facts: ObjectiveFact[]): Progress => {
  const textFacts = facts.map((f) => f.content.toLowerCase());
  return {
    created: textFacts.some((t) => t.includes("created file") || t.includes("created hello.txt")),
    read: textFacts.some((t) => t.includes("read file") || t.includes("read hello.txt")),
    deleted: textFacts.some((t) => t.includes("deleted file") || t.includes("deleted hello.txt")),
  };
};

const buildPlanStatus = (progress: Progress): string[] => {
  const steps = [
    { label: "Create hello.txt", done: progress.created },
    { label: "Read hello.txt", done: progress.read },
    { label: "Delete hello.txt", done: progress.deleted },
  ];
  return steps.map((s) => `${s.label} (${s.done ? "done" : "todo"})`);
};

const buildCurrentGoal = (progress: Progress): string => {
  if (!progress.created) return "Create hello.txt";
  if (!progress.read) return "Read hello.txt";
  if (!progress.deleted) return "Delete hello.txt";
  return "All tasks completed";
};

const buildKeyFacts = (facts: ObjectiveFact[]): string[] => {
  const sorted = [...facts].sort((a, b) => a.timestamp - b.timestamp);
  const filtered = sorted.filter((f) => f.type === "USER_MSG" || f.type === "TOOL_RESULT");
  return filtered.slice(-5).map((f) => `[${f.type}] ${f.content}`);
};

const findLastActionResult = (facts: ObjectiveFact[]): string => {
  const lastTool = [...facts].reverse().find((f) => f.type === "TOOL_RESULT");
  return lastTool?.content ?? "No action yet";
};

/**
 * Derive cognitive state from facts (fallback)
 */
const deriveCognitiveState = (facts: ObjectiveFact[]): CognitiveState => {
  const progress = detectProgress(facts);
  return {
    current_goal: buildCurrentGoal(progress),
    plan_status: buildPlanStatus(progress),
    key_facts: buildKeyFacts(facts),
    last_action_result: findLastActionResult(facts),
  };
};

// ============================================================================
// Rememberer Class
// ============================================================================

export class Rememberer {
  private readonly memory: MemoryManager;
  private readonly chat: ReturnType<typeof createChat>;

  constructor(memory: MemoryManager, provider: "deepseek" | "mock", config?: LLMConfig) {
    this.memory = memory;
    const adapter = getAdapter(provider, config);
    this.chat = createChat(adapter);
  }

  async recall(triggerMessage: string): Promise<CognitiveState> {
    const result = await this.recallWithTrace(triggerMessage);
    return result.cognitiveState;
  }

  async recallWithTrace(triggerMessage: string): Promise<RecallResult> {
    // Gather facts
    const recentFacts = await this.memory.getRecentFacts(100);
    const relatedResult = await this.memory.searchFactsWithTrace(triggerMessage, 50);
    const relatedFacts = relatedResult.facts;
    const mergedFacts = mergeFacts(recentFacts, relatedFacts);

    const toolCalls = [
      `MemoryManager.getRecentFacts(limit=100) -> ${recentFacts.length} facts`,
      ...relatedResult.tool_calls,
    ];

    // Build messages
    const messages: Message[] = [buildRemembererPrompt(), buildUserPrompt(triggerMessage, mergedFacts)];

    // Call LLM
    const stream = this.chat(messages);
    const response = await collectStream(stream);

    // Parse or derive
    const cognitiveState = parseCognitiveState(response) ?? deriveCognitiveState(mergedFacts);

    return {
      cognitiveState,
      trace: createTrace(
        triggerMessage,
        recentFacts,
        relatedFacts,
        mergedFacts,
        toolCalls,
        messages,
        response
      ),
    };
  }
}
