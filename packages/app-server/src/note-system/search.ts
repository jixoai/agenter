import MiniSearch from "minisearch";

import { listNotePages } from "./storage";
import type { NoteIdentity, NoteSearchInput, NoteSearchResult } from "./types";

interface NoteSearchDocument extends NoteIdentity {
  id: string;
  path: string;
  title: string;
  body: string;
}

const createNoteSearchId = (identity: NoteIdentity): string =>
  `${identity.notebook}/${identity.section}/${identity.page}`;

const buildSnippet = (body: string, query: string): string => {
  const token = query.trim().split(/\s+/u).find((part) => part.length > 0)?.toLowerCase();
  if (!token) {
    return body.slice(0, 160);
  }
  const index = body.toLowerCase().indexOf(token);
  if (index < 0) {
    return body.slice(0, 160);
  }
  const start = Math.max(0, index - 48);
  return body.slice(start, Math.min(body.length, index + token.length + 96)).trim();
};

export const searchNotes = (input: NoteSearchInput): NoteSearchResult[] => {
  const query = input.query.trim();
  if (!query) {
    return [];
  }
  const pages = listNotePages({ avatarHome: input.avatarHome, limit: 1_000 });
  const docs: NoteSearchDocument[] = pages.map((page) => ({
    ...page.identity,
    id: createNoteSearchId(page.identity),
    path: page.path,
    title: `${page.identity.notebook} ${page.identity.section} ${page.identity.page}`,
    body: page.body,
  }));
  const byId = new Map(docs.map((doc) => [doc.id, doc] as const));
  const search = new MiniSearch<NoteSearchDocument>({
    fields: ["title", "body", "notebook", "section", "page"],
  });
  search.addAll(docs);
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
  return search
    .search(query, { prefix: true, fuzzy: 0.2 })
    .flatMap((result): NoteSearchResult[] => {
      const doc = byId.get(String(result.id));
      if (!doc) {
        return [];
      }
      return [
        {
          notebook: doc.notebook,
          section: doc.section,
          page: doc.page,
          path: doc.path,
          score: result.score,
          snippet: buildSnippet(doc.body, query),
        },
      ];
    })
    .slice(0, limit);
};
