import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";

export function HelpOverlay() {
  const [show, setShow] = useState(false);

  useInput((input, key) => {
    if (input === "?" && !key.ctrl && !key.meta && !key.shift) {
      setShow((v) => !v);
    }
  });

  if (!show) return null;

  return (
    <Box position="absolute" width="100%" height="100%" padding={2}>
      <Box flexDirection="column">
        <Text bold color="cyan" underline>Agenter TUI Help</Text>
        <Box marginY={1} />
        
        <Text bold>Navigation:</Text>
        <Text>  Ctrl+← →  Switch tabs</Text>
        <Text>  Ctrl+T    Create new tab</Text>
        <Text>  Esc       Clear draft / Re-edit</Text>
        <Box marginY={1} />

        <Text bold>Input:</Text>
        <Text>  Enter         Push to queue</Text>
        <Text>  Shift+Enter   Newline</Text>
        <Text>  /now msg      Execute immediately</Text>
        <Box marginY={1} />

        <Text bold>States:</Text>
        <Text>  ✎ Editing  ⏳ Waiting  ▶ Running  ✓ Finished</Text>
        <Box marginY={1} />

        <Text dimColor>Press ? to close</Text>
      </Box>
    </Box>
  );
}
