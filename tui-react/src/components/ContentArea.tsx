import React from "react";
import { Box, Text } from "ink";
import { Tab } from "../types";
import { TextInput } from "./TextInput";
import { MemoryBox } from "./MemoryBox";

interface Props {
  tab: Tab;
  onDraftChange: (tabId: number, draft: string) => void;
  onSubmit: () => void;
  onHistoryRequest: (direction: "prev" | "next", draft: string) => void;
}

const HELP = "Enter=Queue | Shift+Enter=Newline | Ctrl+T=NewTab | Ctrl+←→=Switch";

function StreamingText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <Text key={i} bold color="cyan">{line.slice(3)}</Text>;
        if (line.startsWith("### ")) return <Text key={i} bold>{"  "}{line.slice(4)}</Text>;
        if (line.startsWith("- ")) return <Text key={i}>  <Text color="yellow">•</Text> {line.slice(2)}</Text>;
        return <Text key={i}>{"  "}{line}</Text>;
      })}
    </>
  );
}

export function ContentArea({ tab, onDraftChange, onSubmit, onHistoryRequest }: Props) {
  const isEditing = tab.status === "editing";
  const isNow = isEditing && tab.draft.trimStart().startsWith("/now");

  const handleChange = (value: string) => {
    onDraftChange(tab.id, value);
  };

  const handleHistoryRequest = (direction: "prev" | "next", draft: string) => {
    onHistoryRequest(direction, draft);
  };

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* USER */}
      <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor={isNow ? "yellow" : "blue"}>
        {isEditing ? (
          <>
            {!tab.draft && <Text dimColor>{HELP}</Text>}
            <TextInput
              tabId={tab.id}
              value={tab.draft}
              onChange={handleChange}
              onSubmit={onSubmit}
              isActive={isEditing}
              onHistoryRequest={handleHistoryRequest}
            />
            {isNow && <Text color="yellow" dimColor>Execute immediately</Text>}
          </>
        ) : (
          <Text color="blue">{tab.userText}</Text>
        )}
      </Box>

      {/* MEMORY - 展示回忆过程 */}
      {!isEditing && (
        <Box flexDirection="column" paddingX={1} marginY={1} borderStyle="single" borderColor="magenta">
          <MemoryBox
            frames={tab.recallFrames}
            state={tab.cognitiveState}
            trace={tab.recallTrace}
          />
        </Box>
      )}

      {/* ANSWER */}
      {!isEditing && (
        <Box flexDirection="column" paddingX={1} flexGrow={1} borderStyle="single" borderColor="green">
          {(tab.summaryText || tab.toolsText) && (
            <Box marginBottom={1}>
              {tab.summaryText && <Text dimColor>summary: {tab.summaryText}</Text>}
              {tab.toolsText && <Text dimColor>tools: {tab.toolsText}</Text>}
            </Box>
          )}
          {tab.answerText ? (
            <Box flexDirection="column">
              <StreamingText text={tab.answerText} />
            </Box>
          ) : (
            <Text dimColor>🤔 Thinking...</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
