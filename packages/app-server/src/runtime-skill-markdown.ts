export interface RuntimeSkillFrontmatter {
  name?: string;
  description?: string;
}

export const normalizeRuntimeSkillName = (value: string): string => value.trim().toLowerCase();

export const parseRuntimeSkillFrontmatter = (content: string): RuntimeSkillFrontmatter => {
  if (!content.startsWith("---\n")) {
    return {};
  }
  const closingIndex = content.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return {};
  }
  const raw = content.slice(4, closingIndex);
  const values: RuntimeSkillFrontmatter = {};
  for (const line of raw.split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key === "name") {
      values.name = value;
    }
    if (key === "description") {
      values.description = value;
    }
  }
  return values;
};

export const stripRuntimeSkillFrontmatter = (content: string): string =>
  content.replace(/^---[\s\S]*?\n---\n/u, "");

export const pickRuntimeSkillBodySummary = (content: string): string => {
  const body = stripRuntimeSkillFrontmatter(content).trim();
  for (const line of body.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    return trimmed;
  }
  return "No summary available.";
};
