import { useState, useCallback } from "react";
import { Tab, RecallFrame } from "../types";
import { createTab, findLastEditingTab, updateTab } from "../utils/tab";

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [queue, setQueue] = useState<number[]>([]);

  const currentTab = tabs[activeIndex];

  const switchTab = useCallback((direction: -1 | 1) => {
    setActiveIndex((idx) => {
      const newIdx = idx + direction;
      if (newIdx < 0) return 0;
      if (newIdx >= tabs.length) return idx; // Stay at last if at end
      return newIdx;
    });
  }, [tabs.length]);

  const switchOrCreateTab = useCallback(() => {
    setActiveIndex((idx) => {
      if (idx === tabs.length - 1) {
        // At last tab, create new one
        const newTab = createTab();
        setTabs((prev) => [...prev, newTab]);
        return idx + 1;
      }
      return idx + 1; // Switch to next
    });
  }, [tabs.length]);

  const goToEditingTab = useCallback(() => {
    const editingIdx = findLastEditingTab(tabs);
    if (editingIdx !== -1) {
      setActiveIndex(editingIdx);
      return true;
    }
    return false;
  }, [tabs]);

  const newTab = useCallback(() => {
    const newTab = createTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveIndex((prev) => prev + 1);
  }, []);

  const updateDraft = useCallback((tabId: number, draft: string) => {
    setTabs((prev) => updateTab(prev, tabId, { draft }));
  }, []);

  const submitToQueue = useCallback((tabId: number) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (!tab?.draft.trim()) return prev;
      return updateTab(prev, tabId, { status: "waiting", userText: tab.draft });
    });
    setQueue((q) => [...q, tabId]);
  }, []);

  const startRunning = useCallback((tabId: number) => {
    setTabs((prev) => updateTab(prev, tabId, { status: "running" }));
  }, []);

  const finishTab = useCallback((tabId: number, answer: string) => {
    setTabs((prev) => updateTab(prev, tabId, { status: "finished", answerText: answer }));
    setQueue((q) => {
      const newQueue = q.filter((id) => id !== tabId);
      return newQueue;
    });
  }, []);

  const errorTab = useCallback((tabId: number, error: string) => {
    setTabs((prev) => updateTab(prev, tabId, { status: "error", answerText: error }));
    setQueue((q) => q.filter((id) => id !== tabId));
  }, []);

  const reEdit = useCallback((tabId: number) => {
    setTabs((prev) => updateTab(prev, tabId, { status: "editing" }));
  }, []);

  const addRecallFrame = useCallback((tabId: number, frame: RecallFrame) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (!tab) return prev;
      return updateTab(prev, tabId, {
        recallFrames: [...tab.recallFrames, frame],
      });
    });
  }, []);

  const updateRecall = useCallback((tabId: number, cognitiveState: any, recallTrace: any) => {
    setTabs((prev) => updateTab(prev, tabId, { cognitiveState, recallTrace }));
  }, []);

  const updateMeta = useCallback((tabId: number, summary: string, tools: string[]) => {
    setTabs((prev) => updateTab(prev, tabId, { summaryText: summary, toolsText: tools.join(", ") }));
  }, []);

  const appendAnswer = useCallback((tabId: number, chunk: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx === -1) return prev;
      const newTabs = [...prev];
      newTabs[idx] = { ...newTabs[idx], answerText: (newTabs[idx].answerText || "") + chunk };
      return newTabs;
    });
  }, []);

  return {
    tabs,
    currentTab,
    activeIndex,
    queue,
    switchTab,
    switchOrCreateTab,
    goToEditingTab,
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
  };
}
