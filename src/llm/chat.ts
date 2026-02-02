/**
 * LLM Chat Functions
 * Functional approach to AI chat completion
 */
import { chat } from "@tanstack/ai";
import type { AnyTextAdapter } from "@tanstack/ai";

// ============================================================================
// Types
// ============================================================================

export type Message = { role: "system" | "user" | "assistant"; content: string };

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Create chat stream
 * @param adapter - Text adapter
 * @param messages - Chat messages
 * @returns Async iterable stream of response chunks
 */
// Type for @tanstack/ai chat input - converts system role to user role for type compatibility
type ChatInputMessage = { role: "user" | "assistant" | "tool"; content: string };

const convertMessages = (messages: Message[]): ChatInputMessage[] => {
  return messages.map(m => ({
    role: m.role === "system" ? "user" : m.role,
    content: m.content,
  }));
};

export const createChatStream = (adapter: AnyTextAdapter, messages: Message[]) => {
  return chat({
    adapter,
    messages: convertMessages(messages),
  });
};

/**
 * Collect stream into single string
 * @param stream - Chat stream
 * @returns Complete response text
 */
interface StreamChunkLike {
  content?: string;
  delta?: string;
  type: string;
}

export const collectStream = async (
  stream: AsyncIterable<StreamChunkLike>
): Promise<string> => {
  let result = "";
  for await (const chunk of stream) {
    if (chunk.type === "TEXT_MESSAGE_CONTENT" && chunk.delta) {
      result += chunk.delta;
    } else if (chunk.type === "text" && chunk.content) {
      result += chunk.content;
    }
  }
  return result;
};

/**
 * Stream with callback for each chunk
 * @param stream - Chat stream
 * @param onChunk - Callback for each chunk
 * @returns Complete response text
 */
export const streamWithCallback = async (
  stream: AsyncIterable<StreamChunkLike>,
  onChunk: (chunk: string) => void
): Promise<string> => {
  let result = "";
  for await (const chunk of stream) {
    const content = chunk.type === "TEXT_MESSAGE_CONTENT" ? chunk.delta :
                   chunk.type === "text" ? chunk.content : undefined;
    if (content) {
      result += content;
      onChunk(content);
    }
  }
  return result;
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create chat function with preset adapter
 * @param adapter - Text adapter
 * @returns Chat function
 */
export const createChat = (adapter: AnyTextAdapter) => {
  return (messages: Message[]) => createChatStream(adapter, messages);
};

// ============================================================================
// Response Parsing
// ============================================================================

export interface ParsedResponse {
  reply: string;
  summary: string;
  tools: string[];
}

/**
 * Parse responder format response
 * Format:
 *   SUMMARY: <sentence>
 *   TOOLS: <comma-separated or NONE>
 *   ANSWER:
 *   <markdown>
 */
export const parseResponderOutput = (raw: string): ParsedResponse => {
  const summaryMatch = raw.match(/SUMMARY:\s*(.*)/i);
  const toolsMatch = raw.match(/TOOLS:\s*(.*)/i);
  const answerIndex = raw.toLowerCase().indexOf("answer:");

  const reply =
    answerIndex === -1 ? raw.trim() : raw.slice(answerIndex + "answer:".length).trim();

  const toolsRaw = toolsMatch?.[1]?.trim() ?? "NONE";
  const tools = toolsRaw === "NONE" || !toolsRaw ? [] : toolsRaw.split(/\s*,\s*/);

  return {
    reply,
    summary: summaryMatch?.[1]?.trim() ?? "(summary unavailable)",
    tools,
  };
};

// ============================================================================
// System Prompt Builders
// ============================================================================

/**
 * Build responder system prompt
 */
export const buildResponderPrompt = (cognitiveState: Record<string, unknown> | { current_goal: string; plan_status: string[]; key_facts: string[]; last_action_result: string }): Message => ({
  role: "system",
  content: [
    "You are Agenter, a helpful assistant.",
    "TASK: RESPOND_USER",
    "Use only COGNITIVE_STATE_JSON to answer the user.",
    "Return in the exact format:",
    "SUMMARY: <one sentence>",
    "TOOLS: <comma-separated or NONE>",
    "ANSWER:",
    "<answer in markdown>",
    "Do NOT reveal chain-of-thought.",
    `COGNITIVE_STATE_JSON=${JSON.stringify(cognitiveState)}`,
  ].join("\n"),
});

/**
 * Build rememberer system prompt
 */
export const buildRemembererPrompt = (): Message => ({
  role: "system",
  content: [
    "You are a memory organizer.",
    "TASK: BUILD_COGNITIVE_STATE",
    "Given RAW_FACTS_JSON, summarize the current goal, plan status, key facts, and last action result.",
    "Return JSON with keys: current_goal, plan_status, key_facts, last_action_result.",
  ].join("\n"),
});
