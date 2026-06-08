import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import type { NoteIdentity, NoteMime, NoteReference, NoteTagSummary } from "./types";

export interface NoteDbPageRecord extends NoteIdentity {
  id: string;
  bookId: string;
  sectionId: string;
  pageId: string;
  path: string;
  mime: NoteMime;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  tagIds: string[];
  references: NoteReference[];
  sourceWorkspace?: string;
}

interface BookRow {
  id: string;
  name: string;
}

interface SectionRow {
  id: string;
  book_id: string;
  name: string;
}

interface PageRow {
  id: string;
  book_id: string;
  section_id: string;
  name: string;
  path: string;
  mime: string;
  created_at: string;
  updated_at: string;
  source_workspace: string | null;
}

interface TagRow {
  id: string;
  name: string;
}

interface ReferenceRow {
  source_page_id: string;
  target_page_id: string;
  uri: string;
  label: string | null;
}

const DB_FILENAME = ".note-system.sqlite";
const MAX_SQL_ROWS = 200;

export const resolveNoteDbPath = (noteRoot: string): string => resolve(noteRoot, DB_FILENAME);

const createId = (prefix: string): string => `${prefix}_${randomUUID()}`;

const rowToString = (value: unknown): string => (typeof value === "string" ? value : "");

const rowToNullableString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const normalizeTagName = (value: string): string => value.trim().toLowerCase();

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => normalizeTagName(value)).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );

export class NoteDatabase {
  private readonly db: Database;

  constructor(readonly noteRoot: string) {
    mkdirSync(noteRoot, { recursive: true });
    this.db = new Database(resolveNoteDbPath(noteRoot), { create: true, strict: true });
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  upsertPage(input: {
    identity: NoteIdentity;
    path: string;
    mime: NoteMime;
    now: string;
    sourceWorkspace?: string;
    tags?: readonly string[];
    references?: readonly NoteReference[];
    existing?: {
      id?: string;
      bookId?: string;
      sectionId?: string;
      pageId?: string;
      createdAt?: string;
    };
  }): NoteDbPageRecord {
    const book = this.getOrCreateBook(input.identity.notebook, input.existing?.bookId, input.now);
    const section = this.getOrCreateSection(book.id, input.identity.section, input.existing?.sectionId, input.now);
    const existingPage = this.getPageByIdentity(input.identity);
    const pageId = existingPage?.id ?? input.existing?.pageId ?? input.existing?.id ?? createId("page");
    const createdAt = existingPage?.created_at ?? input.existing?.createdAt ?? input.now;
    this.db
      .query(
        `insert into note_pages (id, book_id, section_id, name, path, mime, created_at, updated_at, source_workspace)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict(id) do update set
           book_id = excluded.book_id,
           section_id = excluded.section_id,
           name = excluded.name,
           path = excluded.path,
           mime = excluded.mime,
           updated_at = excluded.updated_at,
           source_workspace = excluded.source_workspace`,
      )
      .run(
        pageId,
        book.id,
        section.id,
        input.identity.page,
        input.path,
        input.mime,
        createdAt,
        input.now,
        input.sourceWorkspace ?? existingPage?.source_workspace ?? null,
      );
    this.replacePageTags(pageId, input.tags ?? []);
    if (input.references !== undefined) {
      this.replacePageReferences(pageId, input.references);
    }
    return this.requirePageById(pageId);
  }

  indexExistingPage(input: {
    identity: NoteIdentity;
    path: string;
    mime: NoteMime;
    createdAt: string;
    updatedAt: string;
    sourceWorkspace?: string;
    tags?: readonly string[];
    references?: readonly NoteReference[];
    ids?: {
      bookId?: string;
      sectionId?: string;
      pageId?: string;
      id?: string;
    };
  }): NoteDbPageRecord {
    return this.upsertPage({
      identity: input.identity,
      path: input.path,
      mime: input.mime,
      now: input.updatedAt,
      sourceWorkspace: input.sourceWorkspace,
      tags: input.tags,
      references: input.references,
      existing: {
        id: input.ids?.id,
        bookId: input.ids?.bookId,
        sectionId: input.ids?.sectionId,
        pageId: input.ids?.pageId,
        createdAt: input.createdAt,
      },
    });
  }

  getPageByIdentity(identity: NoteIdentity): PageRow | null {
    return this.db
      .query(
        `select p.*
           from note_pages p
           join note_books b on b.id = p.book_id
           join note_sections s on s.id = p.section_id
           where b.name = ? and s.name = ? and p.name = ?
           limit 1`,
      )
      .get(identity.notebook, identity.section, identity.page) as PageRow | null;
  }

  getPageRecordByIdentity(identity: NoteIdentity): NoteDbPageRecord | null {
    const row = this.getPageByIdentity(identity);
    return row ? this.toPageRecord(row) : null;
  }

  getPageRecordById(pageId: string): NoteDbPageRecord | null {
    const row = this.db.query(`select * from note_pages where id = ? limit 1`).get(pageId) as PageRow | null;
    return row ? this.toPageRecord(row) : null;
  }

  requirePageById(pageId: string): NoteDbPageRecord {
    const page = this.getPageRecordById(pageId);
    if (!page) {
      throw new Error(`note page id not found after write: ${pageId}`);
    }
    return page;
  }

  listPages(
    input: { notebook?: string; section?: string; offset?: number; limit?: number | null } = {},
  ): NoteDbPageRecord[] {
    const limit = input.limit === null ? -1 : Math.max(1, Math.min(input.limit ?? 100, 100_000));
    const offset = Math.max(0, input.offset ?? 0);
    const rows = this.db
      .query(
        `select p.*
         from note_pages p
         join note_books b on b.id = p.book_id
         join note_sections s on s.id = p.section_id
         where (?1 is null or b.name = ?1)
           and (?2 is null or s.name = ?2)
         order by b.name asc, s.name asc, p.name asc
         limit ?3 offset ?4`,
      )
      .all(input.notebook ?? null, input.section ?? null, limit, offset) as PageRow[];
    return rows.map((row) => this.toPageRecord(row));
  }

  listTags(input: { notebook?: string; section?: string } = {}): NoteTagSummary[] {
    const rows = this.db
      .query(
        `select t.id as id, t.name as name, count(*) as count
         from note_tags t
         join note_page_tags pt on pt.tag_id = t.id
         join note_pages p on p.id = pt.page_id
         join note_books b on b.id = p.book_id
         join note_sections s on s.id = p.section_id
         where (?1 is null or b.name = ?1)
           and (?2 is null or s.name = ?2)
         group by t.id, t.name
         order by t.name asc`,
      )
      .all(input.notebook ?? null, input.section ?? null) as Array<{ id: string; name: string; count: number }>;
    return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }));
  }

  filterPageIdsByTags(tags: readonly string[]): Set<string> | null {
    const normalized = uniqueSorted(tags);
    if (normalized.length === 0) {
      return null;
    }
    const placeholders = normalized.map(() => "?").join(", ");
    const rows = this.db
      .query(
        `select p.id as id
         from note_pages p
         join note_page_tags pt on pt.page_id = p.id
         join note_tags t on t.id = pt.tag_id
         where t.name in (${placeholders})
         group by p.id
         having count(distinct t.name) = ?`,
      )
      .all(...normalized, normalized.length) as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  rename(input: {
    notebook: string;
    section: string;
    page?: string;
    toNotebook?: string;
    toSection?: string;
    toPage?: string;
    resolvePath: (identity: NoteIdentity, page: NoteDbPageRecord) => string;
  }): NoteDbPageRecord[] {
    const pages = input.page
      ? this.getPageRecordByIdentity({ notebook: input.notebook, section: input.section, page: input.page })
      : null;
    const targets = input.page
      ? pages
        ? [pages]
        : []
      : this.listPages({ notebook: input.notebook, section: input.section, limit: 1_000 });
    if (targets.length === 0) {
      throw new Error("note rename target not found");
    }
    const renamed: NoteDbPageRecord[] = [];
    this.db.transaction(() => {
      for (const page of targets) {
        const nextIdentity: NoteIdentity = {
          notebook: input.toNotebook ?? page.notebook,
          section: input.toSection ?? page.section,
          page: input.page ? (input.toPage ?? page.page) : page.page,
        };
        const conflict = this.getPageRecordByIdentity(nextIdentity);
        if (conflict && conflict.pageId !== page.pageId) {
          throw new Error(
            `note rename conflict: ${nextIdentity.notebook}/${nextIdentity.section}/${nextIdentity.page}`,
          );
        }
        const book = this.getOrCreateBook(nextIdentity.notebook, undefined, new Date().toISOString());
        const section = this.getOrCreateSection(book.id, nextIdentity.section, undefined, new Date().toISOString());
        const nextPath = input.resolvePath(nextIdentity, page);
        mkdirSync(dirname(nextPath), { recursive: true });
        if (existsSync(page.path) && page.path !== nextPath) {
          renameSync(page.path, nextPath);
          this.pruneEmptyDirs(dirname(page.path));
        }
        this.db
          .query(`update note_pages set book_id = ?, section_id = ?, name = ?, path = ?, updated_at = ? where id = ?`)
          .run(book.id, section.id, nextIdentity.page, nextPath, new Date().toISOString(), page.pageId);
        renamed.push(this.requirePageById(page.pageId));
      }
    })();
    return renamed;
  }

  queryReadOnly(sql: string, limit = MAX_SQL_ROWS): { columns: string[]; rows: Array<Record<string, unknown>> } {
    const trimmed = sql.trim();
    if (!/^select\b/i.test(trimmed) && !/^with\b/i.test(trimmed)) {
      throw new Error("note SQL query is read-only and only accepts SELECT/WITH statements");
    }
    const withoutTrailingSemicolon = trimmed.replace(/;+\s*$/u, "");
    if (
      /--|\/\*/u.test(trimmed) ||
      withoutTrailingSemicolon.includes(";") ||
      /\b(insert|update|delete|drop|alter|attach|detach|pragma|vacuum|replace|create)\b/iu.test(trimmed)
    ) {
      throw new Error("note SQL query rejected mutating statement");
    }
    const bounded = `select * from (${withoutTrailingSemicolon}) limit ${Math.max(1, Math.min(limit, MAX_SQL_ROWS))}`;
    const rows = this.db.query(bounded).all() as Array<Record<string, unknown>>;
    const columns = rows[0] ? Object.keys(rows[0]) : [];
    return { columns, rows };
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists note_books (
        id text primary key,
        name text not null unique,
        created_at text not null,
        updated_at text not null
      );
      create table if not exists note_sections (
        id text primary key,
        book_id text not null references note_books(id) on delete cascade,
        name text not null,
        created_at text not null,
        updated_at text not null,
        unique(book_id, name)
      );
      create table if not exists note_pages (
        id text primary key,
        book_id text not null references note_books(id) on delete cascade,
        section_id text not null references note_sections(id) on delete cascade,
        name text not null,
        path text not null,
        mime text not null,
        created_at text not null,
        updated_at text not null,
        source_workspace text,
        unique(section_id, name)
      );
      create table if not exists note_tags (
        id text primary key,
        name text not null unique
      );
      create table if not exists note_page_tags (
        page_id text not null references note_pages(id) on delete cascade,
        tag_id text not null references note_tags(id) on delete cascade,
        primary key(page_id, tag_id)
      );
      create table if not exists note_references (
        source_page_id text not null references note_pages(id) on delete cascade,
        target_page_id text not null references note_pages(id) on delete cascade,
        uri text not null,
        label text,
        primary key(source_page_id, target_page_id, uri)
      );
      create view if not exists note_pages_view as
        select p.id as pageId,
               b.id as bookId,
               s.id as sectionId,
               b.name as notebook,
               s.name as section,
               p.name as page,
               p.path as path,
               p.mime as mime,
               p.created_at as createdAt,
               p.updated_at as updatedAt,
               p.source_workspace as sourceWorkspace
        from note_pages p
        join note_books b on b.id = p.book_id
        join note_sections s on s.id = p.section_id;
      create view if not exists note_tags_view as
        select id as tagId, name from note_tags;
      create view if not exists note_page_tags_view as
        select pt.page_id as pageId, pt.tag_id as tagId, t.name as tagName
        from note_page_tags pt
        join note_tags t on t.id = pt.tag_id;
      create view if not exists note_references_view as
        select source_page_id as sourcePageId,
               target_page_id as targetPageId,
               b.name as targetNotebook,
               s.name as targetSection,
               p.name as targetPage,
               uri,
               label
        from note_references r
        join note_pages p on p.id = r.target_page_id
        join note_books b on b.id = p.book_id
        join note_sections s on s.id = p.section_id;
    `);
  }

  private getOrCreateBook(name: string, preferredId: string | undefined, now: string): BookRow {
    const existing = this.db
      .query(`select id, name from note_books where name = ? limit 1`)
      .get(name) as BookRow | null;
    if (existing) {
      return existing;
    }
    const id = preferredId && preferredId.length > 0 ? preferredId : createId("book");
    this.db
      .query(`insert into note_books (id, name, created_at, updated_at) values (?, ?, ?, ?)`)
      .run(id, name, now, now);
    return { id, name };
  }

  private getOrCreateSection(bookId: string, name: string, preferredId: string | undefined, now: string): SectionRow {
    const existing = this.db
      .query(`select id, book_id, name from note_sections where book_id = ? and name = ? limit 1`)
      .get(bookId, name) as SectionRow | null;
    if (existing) {
      return existing;
    }
    const id = preferredId && preferredId.length > 0 ? preferredId : createId("section");
    this.db
      .query(`insert into note_sections (id, book_id, name, created_at, updated_at) values (?, ?, ?, ?, ?)`)
      .run(id, bookId, name, now, now);
    return { id, book_id: bookId, name };
  }

  private replacePageTags(pageId: string, tags: readonly string[]): void {
    const normalized = uniqueSorted(tags);
    this.db.query(`delete from note_page_tags where page_id = ?`).run(pageId);
    for (const name of normalized) {
      const tag = this.getOrCreateTag(name);
      this.db.query(`insert or ignore into note_page_tags (page_id, tag_id) values (?, ?)`).run(pageId, tag.id);
    }
  }

  private getOrCreateTag(name: string): TagRow {
    const existing = this.db.query(`select id, name from note_tags where name = ? limit 1`).get(name) as TagRow | null;
    if (existing) {
      return existing;
    }
    const id = createId("tag");
    this.db.query(`insert into note_tags (id, name) values (?, ?)`).run(id, name);
    return { id, name };
  }

  private replacePageReferences(pageId: string, references: readonly NoteReference[]): void {
    this.db.query(`delete from note_references where source_page_id = ?`).run(pageId);
    for (const reference of references) {
      this.db
        .query(
          `insert or ignore into note_references (source_page_id, target_page_id, uri, label)
           values (?, ?, ?, ?)`,
        )
        .run(pageId, reference.pageId, reference.uri, reference.label ?? null);
    }
  }

  private toPageRecord(row: PageRow): NoteDbPageRecord {
    const book = this.db.query(`select id, name from note_books where id = ?`).get(row.book_id) as BookRow;
    const section = this.db.query(`select id, name from note_sections where id = ?`).get(row.section_id) as SectionRow;
    const tagRows = this.db
      .query(
        `select t.id as id, t.name as name
         from note_tags t
         join note_page_tags pt on pt.tag_id = t.id
         where pt.page_id = ?
         order by t.name asc`,
      )
      .all(row.id) as TagRow[];
    const referenceRows = this.db
      .query(`select * from note_references where source_page_id = ? order by uri asc`)
      .all(row.id) as ReferenceRow[];
    const references = referenceRows.flatMap((reference): NoteReference[] => {
      const target = this.getPageRecordById(reference.target_page_id);
      if (!target) {
        return [];
      }
      return [
        {
          label: rowToNullableString(reference.label) ?? undefined,
          uri: rowToString(reference.uri),
          bookId: target.bookId,
          sectionId: target.sectionId,
          pageId: target.pageId,
          notebook: target.notebook,
          section: target.section,
          page: target.page,
        },
      ];
    });
    return {
      id: row.id,
      bookId: book.id,
      sectionId: section.id,
      pageId: row.id,
      notebook: book.name,
      section: section.name,
      page: row.name,
      path: row.path,
      mime: row.mime,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tags: tagRows.map((tag) => tag.name),
      tagIds: tagRows.map((tag) => tag.id),
      references,
      sourceWorkspace: row.source_workspace ?? undefined,
    };
  }

  private pruneEmptyDirs(path: string): void {
    if (resolve(path) === resolve(this.noteRoot)) {
      return;
    }
    try {
      rmSync(path, { recursive: false });
      this.pruneEmptyDirs(dirname(path));
    } catch {
      // Non-empty directories are expected after moving a subset of notes.
    }
  }
}
