import MiniSearch from "minisearch";

import { listNotePages } from "./storage";
import type { NoteIdentity, NoteSearchInput, NoteSearchResult } from "./types";

interface NoteSearchDocument extends NoteIdentity {
  id: string;
  path: string;
  title: string;
  body: string;
  pageId: string;
}

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
  if (!query && (!input.tags || input.tags.length === 0)) {
    return [];
  }
  const pages = listNotePages({ avatarHome: input.avatarHome, limit: 1_000 });
  const requiredTags = new Set((input.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0));
  const filteredPages =
    requiredTags.size === 0
      ? pages
      : pages.filter((page) => {
          const tags = new Set(page.metadata.tags);
          return [...requiredTags].every((tag) => tags.has(tag));
        });
  if (!query) {
    return filteredPages.slice(0, Math.max(1, Math.min(input.limit ?? 20, 100))).map((page) => ({
      ...page.identity,
      id: page.metadata.id,
      bookId: page.metadata.bookId,
      sectionId: page.metadata.sectionId,
      pageId: page.metadata.pageId,
      path: page.path,
      score: 1,
      snippet: page.body.slice(0, 160),
      tags: [...page.metadata.tags],
      references: page.metadata.references.map((reference) => ({ ...reference })),
    }));
  }
  const docs: NoteSearchDocument[] = filteredPages.map((page) => ({
    ...page.identity,
    id: page.metadata.pageId,
    pageId: page.metadata.pageId,
    path: page.path,
    title: `${page.identity.notebook} ${page.identity.section} ${page.identity.page}`,
    body: page.body,
  }));
  const byId = new Map(docs.map((doc) => [doc.id, doc] as const));
  const pageById = new Map(filteredPages.map((page) => [page.metadata.pageId, page] as const));
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
      const page = pageById.get(doc.pageId);
      if (!page) {
        return [];
      }
      return [
        {
          notebook: doc.notebook,
          section: doc.section,
          page: doc.page,
          id: doc.pageId,
          bookId: page.metadata.bookId,
          sectionId: page.metadata.sectionId,
          pageId: doc.pageId,
          path: doc.path,
          score: result.score,
          snippet: buildSnippet(doc.body, query),
          tags: [...page.metadata.tags],
          references: page.metadata.references.map((reference) => ({ ...reference })),
        },
      ];
    })
    .slice(0, limit);
};
