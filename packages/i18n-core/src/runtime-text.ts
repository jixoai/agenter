import { z } from "zod";

export const RUNTIME_TEXT_KEYS = [
  "task.plan.start",
  "task.summary.thinking_only",
  "task.summary.done",
  "task.summary.stage",
  "ai.call_failed",
  "model.missing_api_key",
  "tool.attention_context_list.description",
  "tool.attention_query.description",
  "tool.attention_commit.description",
  "tool.message_channel_list.description",
  "tool.message_channel_get.description",
  "tool.message_send.description",
  "tool.message_send.origin_ack_fallback",
  "tool.terminal_list.description",
  "tool.terminal_create.description",
  "tool.terminal_focus.description",
  "tool.terminal_kill.description",
  "tool.terminal_write.description",
  "tool.terminal_read.description",
  "tool.terminal_snapshot.description",
  "tool.terminal_get_config.description",
  "tool.terminal_set_config.description",
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
