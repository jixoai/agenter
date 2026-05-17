const DISALLOWED_SQL_KEYWORDS = [
  "attach",
  "detach",
  "pragma",
  "alter",
  "create",
  "drop",
  "insert",
  "update",
  "delete",
  "replace",
  "vacuum",
  "reindex",
  "analyze",
  "begin",
  "commit",
  "rollback",
  "savepoint",
  "release",
] as const;

const stripSqlQuotedSections = (value: string): string =>
  value
    .replaceAll(/'(?:''|[^'])*'/gu, "''")
    .replaceAll(/"(?:""|[^"])*"/gu, '""')
    .replaceAll(/`[^`]*`/gu, "``")
    .replaceAll(/\[[^\]]*\]/gu, "[]");

export const assertReadOnlyMcpQuerySql = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("mcp query sql cannot be empty");
  }

  const normalized = trimmed.replace(/;\s*$/u, "");
  const sanitized = stripSqlQuotedSections(normalized);
  if (sanitized.includes(";")) {
    throw new Error("mcp query sql must contain exactly one statement");
  }
  if (/--|\/\*/u.test(sanitized)) {
    throw new Error("mcp query sql comments are not allowed");
  }
  if (!/^(select|with|explain\s+query\s+plan)\b/iu.test(sanitized)) {
    throw new Error("mcp query sql must start with SELECT, WITH, or EXPLAIN QUERY PLAN");
  }
  for (const keyword of DISALLOWED_SQL_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, "iu").test(sanitized)) {
      throw new Error(`mcp query sql cannot use ${keyword.toUpperCase()}`);
    }
  }
  return normalized;
};
