import React from "react";
import { Box, Text } from "ink";
import { Tab } from "../types";

interface Props {
  connectionState: "connecting" | "connected" | "disconnected";
  reconnectAttempt: number;
  currentTab: Tab;
  queueCount: number;
}

export function StatusBar({ connectionState, reconnectAttempt, currentTab, queueCount }: Props) {
  const conn = {
    connecting: { symbol: "◐", text: reconnectAttempt ? `Reconnect ${reconnectAttempt}/5` : "Connecting", color: "yellow" },
    connected: { symbol: "●", text: "Connected", color: "green" },
    disconnected: { symbol: "○", text: "Disconnected", color: "red" },
  }[connectionState];

  const hints: Record<Tab["status"], string> = {
    editing: "Enter=Queue | Shift+Enter=Newline | Ctrl+T=NewTab",
    waiting: "Ctrl+T=NewTab | Ctrl+←→=Switch",
    running: "Processing... | Ctrl+T=NewTab | Ctrl+←→=Switch",
    finished: "Ctrl+T=NewTab | Esc=Re-edit | Ctrl+←→=Switch",
    error: "Ctrl+T=NewTab | Esc=Re-edit | Ctrl+←→=Switch",
  };

  return (
    <Box height={1} flexDirection="row" justifyContent="space-between">
      <Box>
        <Text> </Text>
        <Text color={conn.color}>{conn.symbol}</Text>
        <Text> {conn.text}</Text>
        {queueCount > 0 && connectionState === "connected" && (
          <><Text dimColor> | </Text><Text color="blue">Queue: {queueCount}</Text></>
        )}
      </Box>
      <Text dimColor>{hints[currentTab.status]} </Text>
    </Box>
  );
}
