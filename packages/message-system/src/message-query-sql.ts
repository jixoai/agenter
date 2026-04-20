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
    .replaceAll(/'(?:''|[^'])*'/g, "''")
    .replaceAll(/"(?:\"\"|[^"])*"/g, '""')
    .replaceAll(/`[^`]*`/g, "``")
    .replaceAll(/\[[^\]]*\]/g, "[]");

export const assertReadOnlyMessageQuerySql = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("message query sql cannot be empty");
  }

  const normalized = trimmed.replace(/;\s*$/u, "");
  const sanitized = stripSqlQuotedSections(normalized);
  if (sanitized.includes(";")) {
    throw new Error("message query sql must contain exactly one statement");
  }
  if (/--|\/\*/u.test(sanitized)) {
    throw new Error("message query sql comments are not allowed");
  }
  if (!/^(select|with)\b/iu.test(sanitized)) {
    throw new Error("message query sql must start with SELECT or WITH");
  }
  for (const keyword of DISALLOWED_SQL_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, "iu").test(sanitized)) {
      throw new Error(`message query sql cannot use ${keyword.toUpperCase()}`);
    }
  }
  return normalized;
};
