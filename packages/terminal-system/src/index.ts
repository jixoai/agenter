export { AgenticTerminal } from "./agentic-terminal";
export { keyToSequence, parseMixedInput, runMixedInput } from "./input-parser";
export { readTerminalOutput, readTerminalOutputLines, streamTerminalOutput } from "./output-reader";
export {
  compactRenderForPersistence,
  renderSemanticBuffer,
  renderStructuredBuffer,
  serializeStructuredLinesForLog,
  stripHtmlTags,
} from "./renderer";
export type {
  PageMeta,
  RenderResult,
  RichLine,
  RichSpan,
  StructuredRenderResult,
  TerminalColorMode,
  TerminalColorOption,
  TerminalDirtyMarkResult,
  TerminalDirtySliceOptions,
  TerminalDirtySliceResult,
  TerminalGitLogMode,
  TerminalGitLogOption,
  TerminalLogStyle,
  TerminalLogStyleOption,
  TerminalPendingInputOptions,
  TerminalPendingInputResult,
  TerminalProfile,
  TerminalStatus,
  TerminalStructuredSnapshot,
} from "./types";
