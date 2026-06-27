/**
 * GitHub-style issue discovery + validation, shared across schema controllers.
 *
 * Mirrors the develop-tasks issue standard: one finding per file under
 * `issues/*.md` (excluding `issues/closed/`), YAML front matter with at least
 * `title` / `state` / `github_issue_status`, and body sections Summary /
 * Impact / Evidence plus Recommendation or Resolution.
 */

import { existsSync } from "node:fs";
import { join, relative } from "node:path";

export const ISSUE_FILE_RE = /^\d{3,}-[a-z0-9][a-z0-9-]*\.md$/;

export interface IssueRecord {
  /** Absolute path to the issue file. */
  path: string;
  /** Path relative to the change directory. */
  relativePath: string;
  title: string;
  state: "open" | "resolved" | "closed";
  githubIssueStatus: "open" | "closed";
  sections: string[];
}

export interface IssueValidation {
  record: IssueRecord | null;
  /** Reasons the file failed validation (empty when valid). */
  errors: string[];
}

const ALLOWED_FRONT_KEYS = new Set(["title", "state", "github_issue_status", "label", "milestone", "resolution"]);
const REQUIRED_SECTIONS = ["## Summary", "## Impact", "## Evidence"];

const basename = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/** Recursively walk a directory yielding absolute file paths. */
const walk = async function* (dir: string): AsyncGenerator<string> {
  for await (const entry of new Bun.Glob("**/*").scan({ cwd: dir, absolute: true })) {
    yield entry;
  }
};

const parseFrontMatter = (text: string): Record<string, string> | null => {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("---\n")) {
    return null;
  }
  const end = trimmed.indexOf("\n---");
  if (end < 0) {
    return null;
  }
  const yamlText = trimmed.slice(4, end);
  const result: Record<string, string> = {};
  for (const line of yamlText.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, raw] = match;
    result[key] = raw.replace(/^"|"$/g, "");
  }
  return result;
};

/**
 * Validate a single issue file. Returns the record when valid, or a list of
 * structural errors otherwise.
 */
export const validateIssueFile = (text: string, filename: string): IssueValidation => {
  const errors: string[] = [];
  if (!ISSUE_FILE_RE.test(filename)) {
    return { record: null, errors: [`filename must match ${ISSUE_FILE_RE.source}`] };
  }
  const frontMatter = parseFrontMatter(text);
  if (!frontMatter) {
    return { record: null, errors: ["missing YAML front matter"] };
  }
  const title = (frontMatter.title ?? "").trim();
  const state = (frontMatter.state ?? "").trim();
  const githubIssueStatus = (frontMatter.github_issue_status ?? "").trim();
  if (!title) {
    errors.push("front matter missing title");
  }
  if (state !== "open" && state !== "resolved" && state !== "closed") {
    errors.push(`front matter state must be open|resolved|closed, got: ${state || "(missing)"}`);
  }
  if (githubIssueStatus !== "open" && githubIssueStatus !== "closed") {
    errors.push(`front matter github_issue_status must be open|closed, got: ${githubIssueStatus || "(missing)"}`);
  }
  const unknownKeys = Object.keys(frontMatter).filter((key) => !ALLOWED_FRONT_KEYS.has(key));
  if (unknownKeys.length > 0) {
    errors.push(`front matter has unknown keys: ${unknownKeys.join(", ")}`);
  }

  const body = text.replace(/^---\n[\s\S]*?\n---\n/, "");
  const missingSections = REQUIRED_SECTIONS.filter((section) => !body.includes(section));
  if (missingSections.length > 0) {
    errors.push(`body missing sections: ${missingSections.join(", ")}`);
  }
  if (!body.includes("## Recommendation") && !body.includes("## Resolution")) {
    errors.push("body missing ## Recommendation or ## Resolution");
  }

  if (errors.length > 0) {
    return { record: null, errors };
  }
  return {
    record: {
      path: "",
      relativePath: "",
      title,
      state: state as IssueRecord["state"],
      githubIssueStatus: githubIssueStatus as IssueRecord["githubIssueStatus"],
      sections: REQUIRED_SECTIONS.filter((section) => body.includes(section)),
    },
    errors,
  };
};

/**
 * Discover and validate every active issue file under `<changeDir>/issues/`.
 * Closed issues under `issues/closed/` are ignored (they are archived evidence).
 */
export const collectIssues = async (changeDir: string): Promise<IssueRecord[]> => {
  const issuesDir = join(changeDir, "issues");
  if (!existsSync(issuesDir)) {
    return [];
  }
  const records: IssueRecord[] = [];
  for await (const file of walk(issuesDir)) {
    if (!file.endsWith(".md")) {
      continue;
    }
    if (file.includes(`${join(issuesDir, "closed")}`)) {
      continue;
    }
    const filename = basename(file);
    if (!ISSUE_FILE_RE.test(filename)) {
      continue;
    }
    const text = await Bun.file(file).text();
    const { record } = validateIssueFile(text, filename);
    if (record) {
      records.push({ ...record, path: file, relativePath: relative(changeDir, file) });
    }
  }
  return records.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
};

/** Scan issue files and return per-file validation results (records + errors). */
export const validateIssues = async (
  changeDir: string,
): Promise<Array<{ file: string; relativePath: string; errors: string[] }>> => {
  const issuesDir = join(changeDir, "issues");
  if (!existsSync(issuesDir)) {
    return [];
  }
  const results: Array<{ file: string; relativePath: string; errors: string[] }> = [];
  for await (const file of walk(issuesDir)) {
    if (!file.endsWith(".md")) {
      continue;
    }
    if (file.includes(`${join(issuesDir, "closed")}`)) {
      continue;
    }
    const filename = basename(file);
    if (!ISSUE_FILE_RE.test(filename)) {
      continue;
    }
    const text = await Bun.file(file).text();
    const { errors } = validateIssueFile(text, filename);
    results.push({ file, relativePath: relative(changeDir, file), errors });
  }
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
};
