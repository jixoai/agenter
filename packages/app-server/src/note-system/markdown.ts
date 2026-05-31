import type { NoteMetadata } from "./types";

export interface ParsedNoteMarkdown {
  frontmatter: Record<string, string>;
  body: string;
}

const formatFrontmatterValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value ?? "";
};

export const renderNoteFile = (metadata: NoteMetadata, body: string): string => {
  const lines = [
    "---",
    "kind: note",
    `id: ${formatFrontmatterValue(metadata.id)}`,
    `createdAt: ${formatFrontmatterValue(metadata.createdAt)}`,
    `updatedAt: ${formatFrontmatterValue(metadata.updatedAt)}`,
    `notebook: ${formatFrontmatterValue(metadata.notebook)}`,
    `section: ${formatFrontmatterValue(metadata.section)}`,
    `page: ${formatFrontmatterValue(metadata.page)}`,
    `tags: ${formatFrontmatterValue(metadata.tags)}`,
  ];
  if (metadata.sourceWorkspace) {
    lines.push(`sourceWorkspace: ${formatFrontmatterValue(metadata.sourceWorkspace)}`);
  }
  return `${lines.join("\n")}\n---\n\n${body.trimEnd()}\n`;
};

export const splitNoteFrontmatter = (content: string): ParsedNoteMarkdown => {
  if (!content.startsWith("---\n")) {
    return { frontmatter: {}, body: content };
  }
  const endIndex = content.indexOf("\n---\n", 4);
  if (endIndex < 0) {
    return { frontmatter: {}, body: content };
  }
  const rawFrontmatter = content.slice(4, endIndex);
  const body = content.slice(endIndex + "\n---\n".length).replace(/^\n/u, "").replace(/\n$/u, "");
  const frontmatter: Record<string, string> = {};
  for (const line of rawFrontmatter.split(/\r?\n/u)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body };
};

export const parseNoteTags = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};
