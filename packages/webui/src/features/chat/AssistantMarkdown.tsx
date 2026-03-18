import { CircleAlert, CircleCheckBig, LoaderCircle, Wrench } from "lucide-react";
import { memo, useMemo } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import {
  InlineAffordance,
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceMeta,
  InlineAffordanceTrailingVisual,
} from "../../components/ui/inline-affordance";
import { resolveChatMessagePresentation } from "./chat-contract";
import { buildToolMeta, parseToolPayload } from "./tool-payload";
import { ToolStructuredView } from "./tool-structured-view";

type AssistantChannel = "to_user" | "self_talk" | "tool_call" | "tool_result" | undefined;
type ToolTraceStatus = "calling" | "done" | "failed";

interface AssistantMarkdownProps {
  content: string;
  channel?: AssistantChannel;
  tool?: {
    name?: string;
    ok?: boolean;
  };
  toolTrace?: {
    id: string;
    toolName: string;
    status: ToolTraceStatus;
    meta?: string | null;
    callContent?: string;
    resultContent?: string;
  };
}

const toolDescriptorEqual = (left: AssistantMarkdownProps["tool"], right: AssistantMarkdownProps["tool"]): boolean => {
  return left?.name === right?.name && left?.ok === right?.ok;
};

const toolTraceEqual = (
  left: AssistantMarkdownProps["toolTrace"],
  right: AssistantMarkdownProps["toolTrace"],
): boolean => {
  return (
    left?.id === right?.id &&
    left?.toolName === right?.toolName &&
    left?.status === right?.status &&
    left?.meta === right?.meta &&
    left?.callContent === right?.callContent &&
    left?.resultContent === right?.resultContent
  );
};

const parseToolNameFromBody = (content: string): string | null => {
  const match = content.match(/tool:\s*([^\n]+)/i);
  return match?.[1]?.trim() ?? null;
};

const normalizeToolName = (input: string | null | undefined): string => {
  if (!input) {
    return "tool";
  }
  return input.trim();
};

const statusIcon = (status: ToolTraceStatus) => {
  if (status === "failed") {
    return <CircleAlert className="h-4 w-4 text-rose-600" />;
  }
  if (status === "done") {
    return <CircleCheckBig className="h-4 w-4 text-emerald-600" />;
  }
  return <LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />;
};

const sectionTone = (type: "call" | "result", status: ToolTraceStatus): string => {
  if (type === "call") {
    return "text-slate-500";
  }
  if (status === "failed") {
    return "text-rose-600";
  }
  if (status === "done") {
    return "text-emerald-600";
  }
  return "text-teal-600";
};

const ToolSection = memo(
  ({ label, status, content }: { label: "call" | "result"; status: ToolTraceStatus; content: string }) => {
    const parsed = useMemo(() => parseToolPayload(content), [content]);
    const hasStructured = parsed.data !== null && parsed.data !== undefined;

    return (
      <section className="space-y-1 pt-1.5 first:pt-0">
        <div className={sectionTone(label, status)}>
          <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
        </div>
        <div className="typo-code min-w-0 text-[11px] leading-5">
          {hasStructured ? (
            <ToolStructuredView value={parsed.data} />
          ) : (
            <pre className="overflow-x-auto whitespace-pre text-slate-700">{parsed.body}</pre>
          )}
        </div>
      </section>
    );
  },
);
ToolSection.displayName = "ToolSection";

const ToolTraceBlock = memo(
  ({ toolTrace }: Required<Pick<AssistantMarkdownProps, "toolTrace">>) => {
    return (
      <Accordion type="single" collapsible className="rounded-lg border border-slate-200/90 bg-slate-50/70 px-1.5 py-1">
        <AccordionItem value={toolTrace.id} className="border-0">
          <AccordionTrigger className="w-full rounded-md px-1 py-0.5 text-left text-[11px] hover:no-underline">
            <InlineAffordance className="flex min-w-0 flex-1" fill>
              <InlineAffordanceLeadingVisual>
                <Wrench className="h-3.5 w-3.5 text-slate-700" />
              </InlineAffordanceLeadingVisual>
              <InlineAffordanceLabel className="min-w-0 flex-1 truncate font-medium text-slate-900">
                {toolTrace.toolName}
              </InlineAffordanceLabel>
              {toolTrace.meta ? (
                <InlineAffordanceMeta
                  className="hidden truncate text-[10px] text-slate-500 sm:inline"
                  title={toolTrace.meta}
                >
                  {toolTrace.meta}
                </InlineAffordanceMeta>
              ) : null}
              <InlineAffordanceTrailingVisual>{statusIcon(toolTrace.status)}</InlineAffordanceTrailingVisual>
            </InlineAffordance>
          </AccordionTrigger>
          <AccordionContent className="mt-1.5 border-t border-slate-200/80 pt-1.5">
            <div className="space-y-1.5">
              {toolTrace.callContent ? (
                <ToolSection label="call" status={toolTrace.status} content={toolTrace.callContent} />
              ) : null}
              {toolTrace.resultContent ? (
                <ToolSection label="result" status={toolTrace.status} content={toolTrace.resultContent} />
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  },
  (left, right) => toolTraceEqual(left.toolTrace, right.toolTrace),
);
ToolTraceBlock.displayName = "ToolTraceBlock";

const AssistantText = memo(({ content, channel }: { content: string; channel?: AssistantChannel }) => {
  const presentation = useMemo(
    () =>
      resolveChatMessagePresentation({
        role: "assistant",
        channel,
      }),
    [channel],
  );
  return (
    <MarkdownDocument
      value={content}
      mode="preview"
      usage="chat"
      surface={presentation.markdownSurface}
      syntaxTone={presentation.syntaxTone}
      className="text-[13px] text-current"
    />
  );
});
AssistantText.displayName = "AssistantText";

const AssistantMarkdownComponent = ({ content, channel, tool, toolTrace }: AssistantMarkdownProps) => {
  const normalized = useMemo(() => content.trim(), [content]);
  const parsedToolMessage = useMemo(
    () => (channel === "tool_call" || channel === "tool_result" ? parseToolPayload(normalized, tool?.name) : null),
    [channel, normalized, tool?.name],
  );

  if (toolTrace) {
    return <ToolTraceBlock toolTrace={toolTrace} />;
  }

  if (normalized.length === 0) {
    return null;
  }

  if (channel === "tool_call" || channel === "tool_result") {
    const parsed = parsedToolMessage;
    if (!parsed) {
      return null;
    }
    const status: ToolTraceStatus = channel === "tool_result" ? (tool?.ok === false ? "failed" : "done") : "calling";
    const toolName = normalizeToolName(tool?.name ?? parseToolNameFromBody(normalized) ?? parsed.toolName);
    return (
      <ToolTraceBlock
        toolTrace={{
          id: `${channel}-${toolName}`,
          toolName,
          status,
          meta: buildToolMeta(parsed),
          callContent: channel === "tool_call" ? parsed.body : undefined,
          resultContent: channel === "tool_result" ? parsed.body : undefined,
        }}
      />
    );
  }

  return (
    <div className="typo-body break-words text-current">
      <AssistantText content={normalized} channel={channel} />
    </div>
  );
};

export const AssistantMarkdown = memo(AssistantMarkdownComponent, (left, right) => {
  return (
    left.content === right.content &&
    left.channel === right.channel &&
    toolDescriptorEqual(left.tool, right.tool) &&
    toolTraceEqual(left.toolTrace, right.toolTrace)
  );
});
AssistantMarkdown.displayName = "AssistantMarkdown";
