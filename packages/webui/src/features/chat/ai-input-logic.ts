export interface WorkspacePathToken {
  from: number;
  to: number;
  query: string;
  raw: string;
}

const isTokenBoundary = (char: string): boolean => /\s|[(){}\[\],;:"'`]/.test(char);

export const findWorkspacePathToken = (value: string, cursor: number): WorkspacePathToken | null => {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  let start = safeCursor;
  while (start > 0) {
    const previous = value[start - 1];
    if (!previous || isTokenBoundary(previous)) {
      break;
    }
    start -= 1;
  }

  const token = value.slice(start, safeCursor);
  if (!token.startsWith("@")) {
    return null;
  }

  return {
    from: start,
    to: safeCursor,
    query: token.slice(1),
    raw: token,
  };
};

export const replaceWorkspacePathToken = (
  value: string,
  token: Pick<WorkspacePathToken, "from" | "to">,
  replacement: string,
): { value: string; cursor: number } => {
  const normalizedReplacement = replacement.startsWith("@") ? replacement : `@${replacement}`;
  const nextValue = `${value.slice(0, token.from)}${normalizedReplacement}${value.slice(token.to)}`;
  return {
    value: nextValue,
    cursor: token.from + normalizedReplacement.length,
  };
};
