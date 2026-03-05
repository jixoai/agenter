import { parse, stringify } from "yaml";

import { toTaskRef } from "./task-engine";
import type { Task, TaskCreateInput, TaskRef, TaskRelationshipType, TaskSourceName, TaskTrigger } from "./task-types";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

const refToString = (ref: TaskRef): string => `${ref.source}:${ref.id}`;

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeTriggers = (value: unknown): TaskTrigger[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const output: TaskTrigger[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const trigger = item as Record<string, unknown>;
    if (trigger.type === "manual") {
      output.push({ type: "manual" });
      continue;
    }
    if (trigger.type === "event" && typeof trigger.topic === "string") {
      output.push({ type: "event", topic: trigger.topic.trim() });
      continue;
    }
    if (trigger.type === "at" && typeof trigger.at === "string") {
      output.push({ type: "at", at: trigger.at.trim() });
      continue;
    }
    if (trigger.type === "cron" && typeof trigger.expr === "string") {
      output.push({ type: "cron", expr: trigger.expr.trim() });
      continue;
    }
  }
  return output;
};

const RELATIONSHIP_TYPES: TaskRelationshipType[] = [
  "blocks",
  "blocked_by",
  "relates_to",
  "parent_of",
  "child_of",
  "duplicates",
];

const isRelationshipType = (value: string): value is TaskRelationshipType =>
  RELATIONSHIP_TYPES.includes(value as TaskRelationshipType);

export interface TaskMarkdownRecord {
  frontmatter: Record<string, unknown>;
  body: string;
}

export const parseTaskMarkdownRecord = (markdown: string): TaskMarkdownRecord => {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) {
    return {
      frontmatter: {},
      body: markdown.trim(),
    };
  }
  const rawFrontmatter = match[1] ?? "";
  const parsed = parse(rawFrontmatter);
  const frontmatter = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const body = markdown.slice(match[0].length).trim();
  return { frontmatter, body };
};

export const pickProjectsFromMarkdown = (markdown: string): string[] => {
  const { frontmatter } = parseTaskMarkdownRecord(markdown);
  return normalizeStringArray(frontmatter.projects);
};

export const toTaskCreateInputFromMarkdown = (
  source: TaskSourceName,
  file: string,
  markdown: string,
): TaskCreateInput | null => {
  const { frontmatter, body } = parseTaskMarkdownRecord(markdown);
  const title = typeof frontmatter.title === "string" ? frontmatter.title.trim() : "";
  if (title.length === 0) {
    return null;
  }

  const dependsOn = normalizeStringArray(frontmatter.dependsOn).map((item) => toTaskRef(item, source));

  const relationships: NonNullable<TaskCreateInput["relationships"]> = Array.isArray(frontmatter.relationships)
    ? frontmatter.relationships
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const rel = item as Record<string, unknown>;
          if (typeof rel.type !== "string" || !isRelationshipType(rel.type) || typeof rel.target !== "string") {
            return null;
          }
          return {
            type: rel.type,
            target: toTaskRef(rel.target, source),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  return {
    source,
    sourceFile: file,
    id: typeof frontmatter.id === "string" ? frontmatter.id.trim() : undefined,
    title,
    body,
    status: typeof frontmatter.status === "string" ? (frontmatter.status as TaskCreateInput["status"]) : undefined,
    type: typeof frontmatter.type === "string" ? frontmatter.type : undefined,
    assignees: normalizeStringArray(frontmatter.assignees),
    labels: normalizeStringArray(frontmatter.labels),
    milestone: typeof frontmatter.milestone === "string" ? frontmatter.milestone : undefined,
    projects: normalizeStringArray(frontmatter.projects),
    dependsOn,
    relationships,
    triggers: normalizeTriggers(frontmatter.triggers),
  };
};

export const serializeTaskMarkdown = (task: Task): string => {
  const frontmatter = {
    id: task.id,
    title: task.title,
    status: task.status,
    type: task.type,
    assignees: task.assignees,
    labels: task.labels,
    milestone: task.milestone,
    projects: task.projects,
    dependsOn: task.dependsOn.map(refToString),
    relationships: task.relationships.map((item) => ({
      type: item.type,
      target: refToString(item.target),
    })),
    triggers: task.triggers,
    source: task.source,
    meta: task.meta,
  };

  const yaml = stringify(frontmatter, {
    defaultStringType: "QUOTE_DOUBLE",
    simpleKeys: true,
    lineWidth: 120,
  }).trimEnd();

  const body = task.body.trim();
  return [`---`, yaml, `---`, body].filter((part) => part.length > 0).join("\n");
};
