import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";

interface TextInputProps {
  tabId: number;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  isActive?: boolean;
  onHistoryRequest: (direction: "prev" | "next", currentDraft: string) => void;
}

export function TextInput({ 
  tabId, 
  value, 
  onChange, 
  onSubmit, 
  placeholder, 
  isActive = true,
  onHistoryRequest 
}: TextInputProps) {
  const [cursor, setCursor] = useState(value.length);
  const [undoStack, setUndoStack] = useState<{ text: string; cursor: number }[]>([]);
  const [redoStack, setRedoStack] = useState<{ text: string; cursor: number }[]>([]);

  // Sync cursor when value changes externally
  React.useEffect(() => {
    setCursor((prev) => Math.min(prev, value.length));
  }, [value]);

  const saveUndo = useCallback((text: string, pos: number) => {
    setUndoStack((prev) => [...prev.slice(-19), { text, cursor: pos }]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, { text: value, cursor }]);
      onChange(last.text);
      setCursor(last.cursor);
      return prev.slice(0, -1);
    });
  }, [value, cursor, onChange]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((u) => [...u, { text: value, cursor }]);
      onChange(last.text);
      setCursor(last.cursor);
      return prev.slice(0, -1);
    });
  }, [value, cursor, onChange]);

  useInput((input, key) => {
    if (!isActive) return;

    // Undo/Redo (client-side only)
    if (key.ctrl && input === "z") {
      handleUndo();
      return;
    }
    if (key.ctrl && input === "y") {
      handleRedo();
      return;
    }

    // History navigation (server-side)
    // Only trigger when cursor is at boundary
    if (key.upArrow && cursor === 0) {
      onHistoryRequest("prev", value);
      return;
    }
    if (key.downArrow && cursor >= value.length) {
      onHistoryRequest("next", value);
      return;
    }

    // Cursor movement
    if (key.leftArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.rightArrow) {
      setCursor((c) => Math.min(value.length, c + 1));
      return;
    }
    if (key.ctrl && input === "a") {
      setCursor(0);
      return;
    }
    if (key.ctrl && input === "e") {
      setCursor(value.length);
      return;
    }

    // Submit
    if (key.return && !key.shift) {
      onSubmit();
      setCursor(0);
      setUndoStack([]);
      setRedoStack([]);
      return;
    }

    // Newline (Shift+Enter)
    if (key.return && key.shift) {
      const before = value.slice(0, cursor);
      const after = value.slice(cursor);
      saveUndo(value, cursor);
      onChange(before + "\n" + after);
      setCursor(cursor + 1);
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      if (cursor === 0) return;
      const before = value.slice(0, cursor - 1);
      const after = value.slice(cursor);
      saveUndo(value, cursor);
      onChange(before + after);
      setCursor(cursor - 1);
      return;
    }

    // Regular input
    if (!key.ctrl && !key.meta && input) {
      const before = value.slice(0, cursor);
      const after = value.slice(cursor);
      saveUndo(value, cursor);
      onChange(before + input + after);
      setCursor(cursor + input.length);
    }
  }, { isActive });

  // Render with cursor
  const lines = value.split("\n");
  let charCount = 0;
  let cursorLine = 0;
  let cursorCol = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length + (i > 0 ? 1 : 0); // +1 for \n
    if (charCount + lineLen > cursor) {
      cursorLine = i;
      cursorCol = cursor - charCount - (i > 0 ? 1 : 0);
      break;
    }
    charCount += lineLen;
    if (i === lines.length - 1) {
      cursorLine = i;
      cursorCol = lines[i].length;
    }
  }

  return (
    <Box flexDirection="column">
      {!value && placeholder && <Text dimColor>{placeholder}</Text>}
      {lines.map((line, i) => {
        if (i !== cursorLine) {
          return <Text key={i}>{line || " "}</Text>;
        }
        const before = line.slice(0, cursorCol);
        const cursorChar = line[cursorCol] || " ";
        const after = line.slice(cursorCol + 1);
        return (
          <Box key={i}>
            <Text>{before}</Text>
            <Text color="black" backgroundColor="white">{cursorChar}</Text>
            <Text>{after}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
