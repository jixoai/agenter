export interface AIInputSuggestion {
  label: string;
  path: string;
  isDirectory: boolean;
  ignored?: boolean;
}

export interface AIInputSubmitPayload {
  text: string;
  assets: File[];
}

export const COMPLETION_LIMIT = 8;

export const SLASH_COMMANDS = [
  { label: "/compact", detail: "compact context" },
  { label: "/start", detail: "start session" },
  { label: "/stop", detail: "stop session" },
  { label: "/screenshot", detail: "capture screen" },
] as const;

export type AIInputCommand = (typeof SLASH_COMMANDS)[number]["label"];

export const resolveAIInputCommand = (value: string): AIInputCommand | null => {
  const trimmed = value.trim();
  return SLASH_COMMANDS.some((item) => item.label === trimmed) ? (trimmed as AIInputCommand) : null;
};
