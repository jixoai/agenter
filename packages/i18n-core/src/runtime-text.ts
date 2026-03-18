import { z } from "zod";

export const RUNTIME_TEXT_KEYS = [
  "task.plan.start",
  "task.summary.thinking_only",
  "task.summary.done",
  "task.summary.stage",
  "ai.call_failed",
  "model.missing_api_key",
  "tool.attention_list.description",
  "tool.attention_add.description",
  "tool.attention_remark.description",
  "tool.attention_query.description",
  "tool.attention_reply.description",
  "tool.terminal_list.description",
  "tool.terminal_run.description",
  "tool.terminal_focus.description",
  "tool.terminal_kill.description",
  "tool.terminal_slice_dirty.description",
  "tool.terminal_write.description",
  "tool.terminal_read.description",
  "tool.task_list.description",
  "tool.task_get.description",
  "tool.task_import.description",
  "tool.task_create.description",
  "tool.task_update.description",
  "tool.task_done.description",
  "tool.task_add_dependency.description",
  "tool.task_remove_dependency.description",
  "tool.task_trigger_manual.description",
  "tool.task_emit_event.description",
] as const;

export type RuntimeTextId = (typeof RUNTIME_TEXT_KEYS)[number];
export type RuntimeTextCatalog = Record<RuntimeTextId, string>;

export const runtimeTextCatalogSchema = z.object(
  Object.fromEntries(RUNTIME_TEXT_KEYS.map((key) => [key, z.string()])) as Record<RuntimeTextId, z.ZodString>,
);
