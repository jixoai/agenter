export interface NotesSearchSyntax {
  query: string;
  tags: string[];
}

const TAG_TOKEN_PATTERN = /(?:^|\s)tag:([^\s]+)/giu;

const normalizeTagToken = (value: string): string => value.trim().toLowerCase();

const uniqueStable = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
};

export const parseNotesSearchSyntax = (input: string): NotesSearchSyntax => {
  const tags: string[] = [];
  const query = input
    .replace(TAG_TOKEN_PATTERN, (_match: string, rawTag: string) => {
      const tag = normalizeTagToken(rawTag);
      if (tag) {
        tags.push(tag);
      }
      return " ";
    })
    .replace(/\s+/gu, " ")
    .trim();
  return {
    query,
    tags: uniqueStable(tags),
  };
};

export const formatNotesSearchTagToken = (tagName: string): string => `tag:${normalizeTagToken(tagName)}`;

export const upsertNotesSearchTag = (input: string, tagName: string, options: { replace?: boolean } = {}): string => {
  const tagToken = formatNotesSearchTagToken(tagName);
  if (options.replace) {
    return tagToken;
  }
  const parsed = parseNotesSearchSyntax(input);
  if (parsed.tags.includes(normalizeTagToken(tagName))) {
    return input.trim();
  }
  return [input.trim(), tagToken].filter((part) => part.length > 0).join(" ");
};
