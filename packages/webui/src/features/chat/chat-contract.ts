import type { MarkdownDocumentSurface, MarkdownDocumentSyntaxTone } from "../../components/markdown/MarkdownDocument";

export type ChatRenderRole = "user" | "assistant";
export type ChatRenderChannel = "to_user" | "self_talk" | "tool_call" | "tool_result" | undefined;

export interface ChatMessagePresentation {
  bubbleClassName: string;
  markdownSurface: MarkdownDocumentSurface;
  syntaxTone: MarkdownDocumentSyntaxTone;
}

export const resolveChatMessagePresentation = (input: {
  role: ChatRenderRole;
  channel?: ChatRenderChannel;
}): ChatMessagePresentation => {
  if (input.role === "user") {
    return {
      bubbleClassName: "bg-teal-600 text-white",
      markdownSurface: "bubble-user",
      syntaxTone: "accented",
    };
  }

  if (input.channel === "self_talk") {
    return {
      bubbleClassName: "bg-slate-100 text-slate-700",
      markdownSurface: "bubble-self-talk",
      syntaxTone: "accented",
    };
  }

  return {
    bubbleClassName: "bg-slate-50 text-slate-900 ring-1 ring-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    markdownSurface: "bubble-assistant",
    syntaxTone: "accented",
  };
};
