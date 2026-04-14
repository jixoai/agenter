import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { SessionDb, type SessionAiCallRecord, type SessionMessageScope } from "@agenter/session-system";

const SESSION_DB_FILE_NAME = "session.db";
const SESSION_MESSAGE_SCOPES = ["heartbeat_part", "prompt_window", "request_aux"] as const satisfies readonly SessionMessageScope[];

export interface SessionDbScopeCount {
  c: number;
}

export interface SessionDbMonitorAiCall {
  id: number;
  kind: SessionAiCallRecord["kind"];
  status: SessionAiCallRecord["status"];
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export interface SessionDbMonitorSnapshot {
  counts: Partial<Record<SessionMessageScope, SessionDbScopeCount>>;
  aiCalls: SessionDbMonitorAiCall[];
}

export interface SingleAvatarMonitorStartRecord {
  event: "start";
  scenario: string;
  sessionId: string;
  sessionRoot: string;
  workspacePath: string;
  avatarNickname: string;
  avatarPromptPath: string | null;
  expectedUrl?: string;
}

export interface TeamMonitorStartRecord {
  event: "start";
  scenario: string;
  workspacePath: string;
  backend: {
    sessionId: string;
    avatarNickname: string;
    avatarPromptPath: string | null;
  };
  frontend: {
    sessionId: string;
    avatarNickname: string;
    avatarPromptPath: string | null;
  };
  expectedUrl?: string;
}

export interface RoomTerminalPhaseTimings {
  totalMs: number;
  acknowledgementMs: number;
  deliveryMs: number;
  updateMs: number;
  acknowledgementToDeliveryMs: number;
  feedbackToUpdateMs: number;
}

const sessionDbPath = (sessionRoot: string): string => join(sessionRoot, SESSION_DB_FILE_NAME);

const listAllAiCalls = (db: SessionDb): SessionAiCallRecord[] => {
  const pages: SessionAiCallRecord[][] = [];
  let before: { beforeTimeMs: number; beforeId: number } | undefined;
  while (true) {
    const page = db.pageAiCalls({ before, limit: 1_000 });
    if (page.items.length === 0) {
      break;
    }
    pages.push(page.items);
    if (!page.hasMoreBefore || !page.nextBefore) {
      break;
    }
    before = page.nextBefore;
  }
  return pages.reverse().flat();
};

export const collectSessionDbMonitorSnapshot = (sessionRoot: string): SessionDbMonitorSnapshot => {
  const db = new SessionDb(sessionDbPath(sessionRoot));
  try {
    const counts = Object.fromEntries(
      SESSION_MESSAGE_SCOPES.map((scope) => [scope, { c: db.listMessagesByScope(scope, { limit: 10_000 }).length }]),
    ) as SessionDbMonitorSnapshot["counts"];
    const aiCalls = listAllAiCalls(db).map((call) => ({
      id: call.id,
      kind: call.kind,
      status: call.status,
      created_at: call.createdAt,
      updated_at: call.updatedAt,
      completed_at: call.completedAt,
    }));
    return { counts, aiCalls };
  } finally {
    db.close();
  }
};

export const summarizeAiCallDurations = (sessionRoot: string): Array<{
  id: number;
  kind: SessionAiCallRecord["kind"];
  status: SessionAiCallRecord["status"];
  durationMs: number;
}> => {
  const db = new SessionDb(sessionDbPath(sessionRoot));
  try {
    return listAllAiCalls(db).map((call) => ({
      id: call.id,
      kind: call.kind,
      status: call.status,
      durationMs: (call.completedAt ?? call.updatedAt) - call.createdAt,
    }));
  } finally {
    db.close();
  }
};

export const createSingleAvatarMonitorStartRecord = (
  input: Omit<SingleAvatarMonitorStartRecord, "event">,
): SingleAvatarMonitorStartRecord => ({
  event: "start",
  ...input,
});

export const createTeamMonitorStartRecord = (input: Omit<TeamMonitorStartRecord, "event">): TeamMonitorStartRecord => ({
  event: "start",
  ...input,
});

export const summarizeRoomTerminalPhaseTimings = (input: {
  startedAt: number;
  acknowledgementAt: number;
  deliveryAt: number;
  feedbackSentAt: number;
  updateAt: number;
}): RoomTerminalPhaseTimings => ({
  totalMs: Math.max(0, input.updateAt - input.startedAt),
  acknowledgementMs: Math.max(0, input.acknowledgementAt - input.startedAt),
  deliveryMs: Math.max(0, input.deliveryAt - input.startedAt),
  updateMs: Math.max(0, input.updateAt - input.feedbackSentAt),
  acknowledgementToDeliveryMs: Math.max(0, input.deliveryAt - input.acknowledgementAt),
  feedbackToUpdateMs: Math.max(0, input.updateAt - input.feedbackSentAt),
});

export const copySessionDbSnapshot = async (input: {
  sessionRoot: string;
  outputDir?: string;
  fileName: string;
}): Promise<string> => {
  const outputDir = input.outputDir ?? "/tmp/agenter-real-scenario-check";
  await mkdir(outputDir, { recursive: true });
  const destinationPath = join(outputDir, input.fileName);
  await copyFile(sessionDbPath(input.sessionRoot), destinationPath);
  return destinationPath;
};
