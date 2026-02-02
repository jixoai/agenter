import React, { useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { TabBar } from "./components/TabBar";
import { ContentArea } from "./components/ContentArea";
import { StatusBar } from "./components/StatusBar";
import { HelpOverlay } from "./components/HelpOverlay";
import { useTabs } from "./hooks/useTabs";
import { useWebSocket } from "./hooks/useWebSocket";

interface AppProps {
  debug?: boolean;
}

export function App({ debug }: AppProps) {
  const { exit } = useApp();
  const ws = useWebSocket();
  const {
    tabs,
    currentTab,
    activeIndex,
    queue,
    switchTab,
    switchOrCreateTab,
    newTab,
    updateDraft,
    submitToQueue,
    startRunning,
    finishTab,
    errorTab,
    reEdit,
    addRecallFrame,
    updateRecall,
    updateMeta,
    appendAnswer,
  } = useTabs();

  // Handle WebSocket messages
  useEffect(() => {
    if (!ws.lastMessage) return;
    const msg = ws.lastMessage;
    const tabId = msg.tab_id || 1;

    switch (msg.type) {
      case "recall_start":
        addRecallFrame(tabId, { type: "recall_start", trigger: msg.trigger });
        break;
      case "recall_activate":
        addRecallFrame(tabId, {
          type: "recall_activate",
          round: msg.round,
          memories: msg.memories,
          pattern: msg.pattern,
        });
        break;
      case "recall_hold":
        addRecallFrame(tabId, {
          type: "recall_hold",
          slots: msg.slots,
          operations: msg.operations,
        });
        break;
      case "recall_feel":
        addRecallFrame(tabId, {
          type: "recall_feel",
          valence: msg.valence,
          arousal: msg.arousal,
          priority: msg.priority,
        });
        break;
      case "recall_result":
        updateRecall(tabId, msg.cognitive_state, msg.recall_trace);
        break;
      case "respond_meta":
        updateMeta(tabId, msg.summary, msg.tools);
        break;
      case "respond_delta":
        appendAnswer(tabId, msg.delta);
        break;
      case "respond_done":
        finishTab(tabId, msg.reply);
        break;
      case "history_result":
        if (tabs.find(t => t.id === tabId)?.status === "editing") {
          updateDraft(tabId, msg.text);
        }
        break;
      case "error":
        errorTab(tabId, msg.message);
        break;
    }
  }, [ws.lastMessage]);

  // Process queue - use a ref to avoid dependency on tabs
  const tabsRef = React.useRef(tabs);
  tabsRef.current = tabs;
  
  useEffect(() => {
    if (queue.length === 0) return;
    const firstId = queue[0];
    const firstTab = tabsRef.current.find((t) => t.id === firstId);
    if (firstTab && firstTab.status === "waiting") {
      startRunning(firstId);
      ws.send({ type: "chat", tab_id: firstId, message: firstTab.draft });
    }
  }, [queue]); // Only depend on queue

  // Global shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === "c") return exit();
    if (key.ctrl && input === "t") return newTab();
    if (key.ctrl && key.leftArrow) return switchTab(-1);
    if (key.ctrl && key.rightArrow) return switchOrCreateTab();
    if (key.escape) {
      if (currentTab.status === "editing") {
        updateDraft(currentTab.id, "");
      } else {
        reEdit(currentTab.id);
      }
    }
  });

  const handleSubmit = () => {
    if (currentTab.status !== "editing" || !currentTab.draft.trim()) return;

    if (currentTab.draft.startsWith("/now ")) {
      const message = currentTab.draft.slice(5);
      updateDraft(currentTab.id, message);
      startRunning(currentTab.id);
      ws.send({ type: "chat", tab_id: currentTab.id, message });
    } else {
      submitToQueue(currentTab.id);
    }
  };

  const handleHistoryRequest = (direction: "prev" | "next", draft: string) => {
    const msg = direction === "prev" ? "history_prev" : "history_next";
    ws.send({ type: msg, tab_id: currentTab.id, current_draft: draft });
  };

  return (
    <Box flexDirection="column" height="100%">
      <HelpOverlay />
      <TabBar tabs={tabs} activeIndex={activeIndex} />
      <ContentArea
        tab={currentTab}
        onDraftChange={updateDraft}
        onSubmit={handleSubmit}
        onHistoryRequest={handleHistoryRequest}
      />
      {debug && <Text dimColor>Debug</Text>}
      {ws.logs.length > 0 && (
        <Box height={1}>
          <Text dimColor>{ws.logs[ws.logs.length - 1].message}</Text>
        </Box>
      )}
      <StatusBar
        connectionState={ws.isConnected ? "connected" : "connecting"}
        reconnectAttempt={ws.reconnectAttempt}
        currentTab={currentTab}
        queueCount={queue.length}
      />
    </Box>
  );
}
