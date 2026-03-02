import type { ReactNode } from "react";
import type { RefObject } from "react";
import type { TextRenderable } from "@opentui/core";

import type { TerminalSnapshot } from "../../core/protocol";

interface TerminalPanelProps {
  snapshot: TerminalSnapshot;
  focused: boolean;
  contentRef: RefObject<TextRenderable | null>;
  title?: string;
}

export const TerminalPanel = ({ snapshot, focused, contentRef, title = "terminal" }: TerminalPanelProps) => {
  const panelTitle = focused ? `${title} *` : title;
  return (
    <box border borderColor={focused ? "cyan" : "gray"} title={panelTitle} flexDirection="column" width="60%" height="100%">
      <scrollbox flexGrow={1} padding={1}>
        <text ref={contentRef} selectable>
          {snapshot.richLines.map((line, lineIndex) => (
            <span key={`line-${lineIndex}`}>
              {line.spans.map((span, spanIndex) => {
                let content: ReactNode = (
                  <span key={`text-${lineIndex}-${spanIndex}`} fg={span.fg} bg={span.bg}>
                    {span.text}
                  </span>
                );
                if (span.bold) {
                  content = <strong>{content}</strong>;
                }
                if (span.italic) {
                  content = <em>{content}</em>;
                }
                if (span.underline) {
                  content = <u>{content}</u>;
                }
                return <span key={`span-${lineIndex}-${spanIndex}`}>{content}</span>;
              })}
              {lineIndex < snapshot.richLines.length - 1 ? <br /> : null}
            </span>
          ))}
        </text>
      </scrollbox>
    </box>
  );
};
