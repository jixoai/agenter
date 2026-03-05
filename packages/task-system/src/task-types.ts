export type TaskSourceName = string;

export type TaskStatus = "backlog" | "pending" | "ready" | "running" | "done" | "failed" | "canceled";

export type TaskRelationshipType = "blocks" | "blocked_by" | "relates_to" | "parent_of" | "child_of" | "duplicates";

export interface TaskRef {
  source: TaskSourceName;
  id: string;
}

export interface TaskRelationship {
  type: TaskRelationshipType;
  target: TaskRef;
}

export interface TaskTriggerManual {
  type: "manual";
}

export interface TaskTriggerEvent {
  type: "event";
  topic: string;
}

export interface TaskTriggerAt {
  type: "at";
  at: string;
}

export interface TaskTriggerCron {
  type: "cron";
  expr: string;
}

export type TaskTrigger = TaskTriggerManual | TaskTriggerEvent | TaskTriggerAt | TaskTriggerCron;

export interface TaskSourceInfo {
  name: TaskSourceName;
  file: string;
}

export interface TaskMeta {
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Task {
  id: string;
  title: string;
  body: string;
  status: TaskStatus;
  type?: string;
  assignees: string[];
  labels: string[];
  milestone?: string;
  projects: string[];
  dependsOn: TaskRef[];
  relationships: TaskRelationship[];
  triggers: TaskTrigger[];
  source: TaskSourceInfo;
  meta: TaskMeta;
}

export interface TaskDerived {
  key: string;
  blockedBy: string[];
  blocks: string[];
  ready: boolean;
  progress: number;
}

export interface TaskView extends Task, TaskDerived {}

export interface TaskCreateInput {
  source: TaskSourceName;
  id?: string;
  title: string;
  body?: string;
  status?: TaskStatus;
  type?: string;
  assignees?: string[];
  labels?: string[];
  milestone?: string;
  projects?: string[];
  dependsOn?: Array<string | TaskRef>;
  relationships?: Array<{
    type: TaskRelationshipType;
    target: string | TaskRef;
  }>;
  triggers?: TaskTrigger[];
  sourceFile?: string;
}

export interface TaskPatchInput {
  title?: string;
  body?: string;
  status?: TaskStatus;
  type?: string;
  assignees?: string[];
  labels?: string[];
  milestone?: string;
  projects?: string[];
  dependsOn?: Array<string | TaskRef>;
  relationships?: Array<{
    type: TaskRelationshipType;
    target: string | TaskRef;
  }>;
  triggers?: TaskTrigger[];
}

export interface TaskUpdateInput {
  source: TaskSourceName;
  id: string;
  patch: TaskPatchInput;
}

export interface TaskDoneResult {
  ok: boolean;
  task?: TaskView;
  affected: TaskView[];
  reason?: string;
}

export interface TaskImportItem {
  source: TaskSourceName;
  file: string;
  task: Omit<TaskCreateInput, "source" | "sourceFile">;
}

export interface TaskImportResult {
  created: number;
  updated: number;
  items: TaskView[];
}

export interface TaskEventInput {
  topic: string;
  payload?: unknown;
  source?: "api" | "file" | "tool";
}

export interface TaskTriggerResult {
  topic: string;
  source: "api" | "file" | "scheduler" | "tool";
  affected: TaskView[];
}
