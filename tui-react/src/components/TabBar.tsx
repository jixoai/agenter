import React from "react";
import { Box, Text } from "ink";
import { Tab, TabStatus } from "../types";

interface TabBarProps {
  tabs: Tab[];
  activeIndex: number;
}

function getSymbol(status: TabStatus): string {
  const map: Record<TabStatus, string> = {
    editing: "✎",
    waiting: "⏳",
    running: "▶",
    finished: "✓",
    error: "✗",
  };
  return map[status];
}

function getColor(status: TabStatus): string {
  const map: Record<TabStatus, string> = {
    editing: "white",
    waiting: "blue",
    running: "magenta",
    finished: "green",
    error: "red",
  };
  return map[status];
}

export function TabBar({ tabs, activeIndex }: TabBarProps) {
  // Calculate visible range - keep active tab visible
  let start = 0;
  let end = tabs.length;
  const maxVisible = 10;

  if (tabs.length > maxVisible) {
    const half = Math.floor(maxVisible / 2);
    start = Math.max(0, activeIndex - half);
    end = Math.min(tabs.length, start + maxVisible);
    if (end - start < maxVisible) start = end - maxVisible;
  }

  const visible = tabs.slice(start, end);
  const showLeft = start > 0;
  const showRight = end < tabs.length;

  return (
    <Box height={1}>
      <Text> </Text>
      {showLeft && <Text dimColor>... </Text>}
      {visible.map((tab, i) => {
        const idx = start + i;
        const isActive = idx === activeIndex;
        const label = tab.status === "waiting" && tab.queuePosition
          ? `${getSymbol(tab.status)}${tab.id}[${tab.queuePosition}]`
          : `${getSymbol(tab.status)}${tab.id}`;
        return (
          <Box key={tab.id} marginRight={1}>
            {i > 0 && <Text dimColor>| </Text>}
            <Text
              color={getColor(tab.status)}
              bold={isActive}
              dimColor={!isActive}
              underline={isActive}
            >
              {label}
            </Text>
          </Box>
        );
      })}
      {showRight && <Text dimColor> ...</Text>}
    </Box>
  );
}
