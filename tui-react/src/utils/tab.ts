import { Tab } from "../types";

let nextTabId = 1;

export function createTab(overrides?: Partial<Tab>): Tab {
  const tab: Tab = {
    id: nextTabId++,
    status: "editing",
    draft: "",
    userText: "",
    answerText: "",
    summaryText: "",
    toolsText: "",
    recallFrames: [],
  };
  if (overrides) {
    Object.assign(tab, overrides);
    // Ensure recallFrames is always an array
    tab.recallFrames = overrides.recallFrames ?? [];
  }
  return tab;
}

export function findLastEditingTab(tabs: Tab[]): number {
  for (let i = tabs.length - 1; i >= 0; i--) {
    if (tabs[i].status === "editing") return i;
  }
  return -1;
}

export function updateTab(tabs: Tab[], tabId: number, updates: Partial<Tab>): Tab[] {
  const idx = tabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return tabs;
  const newTabs = [...tabs];
  newTabs[idx] = { ...newTabs[idx], ...updates };
  return newTabs;
}
