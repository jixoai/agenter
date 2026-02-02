/**
 * LLM Module
 * Functional AI chat completion interface
 */

// Adapters
export {
  DeepSeekAdapter,
  MockAdapter,
  getAdapter,
  type LLMConfig,
  type Message,
} from "./adapters.js";

// Chat
export {
  createChatStream,
  collectStream,
  streamWithCallback,
  createChat,
  parseResponderOutput,
  buildResponderPrompt,
  buildRemembererPrompt,
  type ParsedResponse,
} from "./chat.js";

// Config
export { loadRuntimeConfig, type ResolvedConfig } from "./config.js";
