// Tab States
export type TabStatus = "editing" | "waiting" | "running" | "finished" | "error";

// Cognitive State from Rememberer
export interface CognitiveState {
  current_goal: string;
  plan_status: string[];
  key_facts: string[];
  last_action_result: string;
}

// Recall Trace from Rememberer
export interface RecallTrace {
  recentCount: number;
  relatedCount: number;
  mergedCount: number;
  toolCalls: string[];
}

// Tab Data Structure
export interface Tab {
  id: number;
  status: TabStatus;
  queuePosition?: number;
  // Input
  draft: string;
  userText: string;
  // Recall Result (final)
  cognitiveState?: CognitiveState;
  recallTrace?: RecallTrace;
  // Real-time Recall Frames (for animation)
  recallFrames: RecallFrame[];
  // Response
  summaryText: string;
  toolsText: string;
  answerText: string;
}

// ===== Recall Frame Types (Streaming) =====

export interface RecallStartFrame {
  type: "recall_start";
  trigger: string;
}

export interface RecallActivateFrame {
  type: "recall_activate";
  round: number;
  memories: Array<{
    content: string;
    relevance: number;
    emotional_tag?: string;
  }>;
  pattern: string;
}

export interface RecallHoldFrame {
  type: "recall_hold";
  slots: string[];
  operations: string[];
}

export interface RecallFeelFrame {
  type: "recall_feel";
  valence: "positive" | "negative" | "neutral";
  arousal: number;
  priority: "high" | "medium" | "low";
}

export interface RecallStateUpdateFrame {
  type: "recall_state_update";
  field: string;
  value: any;
  reason: string;
}

export interface RecallCompleteFrame {
  type: "recall_result";
  cognitive_state: CognitiveState;
  recall_trace: RecallTrace;
}

export type RecallFrame =
  | RecallStartFrame
  | RecallActivateFrame
  | RecallHoldFrame
  | RecallFeelFrame
  | RecallStateUpdateFrame
  | RecallCompleteFrame;

// ===== WebSocket Message Types =====

export interface WSRecallStart {
  type: "recall_start";
  tab_id: number;
  trigger: string;
}

export interface WSRecallActivate {
  type: "recall_activate";
  tab_id: number;
  round: number;
  memories: Array<{
    content: string;
    relevance: number;
    emotional_tag?: string;
  }>;
  pattern: string;
}

export interface WSRecallHold {
  type: "recall_hold";
  tab_id: number;
  slots: string[];
  operations: string[];
}

export interface WSRecallFeel {
  type: "recall_feel";
  tab_id: number;
  valence: "positive" | "negative" | "neutral";
  arousal: number;
  priority: "high" | "medium" | "low";
}

export interface WSRecallResult {
  type: "recall_result";
  tab_id: number;
  cognitive_state: CognitiveState;
  recall_trace: RecallTrace;
}

export interface WSRespondMeta {
  type: "respond_meta";
  tab_id: number;
  summary: string;
  tools: string[];
}

export interface WSHistoryResult {
  type: "history_result";
  tab_id?: number;
  text: string;
  has_more: boolean;
}

export interface WSRespondDelta {
  type: "respond_delta";
  tab_id: number;
  delta: string;
}

export interface WSRespondDone {
  type: "respond_done";
  tab_id: number;
  reply: string;
  summary: string;
  tools: string[];
}

export interface WSError {
  type: "error";
  tab_id?: number;
  message: string;
}

export type WSMessage =
  | WSRecallStart
  | WSRecallActivate
  | WSRecallHold
  | WSRecallFeel
  | WSRecallResult
  | WSRespondMeta
  | WSHistoryResult
  | WSRespondDelta
  | WSRespondDone
  | WSError;

// Debug
export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}
