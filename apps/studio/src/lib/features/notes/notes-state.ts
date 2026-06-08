import type {
  NoteCatalogOutput,
  NoteNotebookListOutput,
  NotePageListOutput,
  NotePageSummary,
  NoteSearchResult,
  NoteSqlQueryOutput,
  NoteSectionListOutput,
} from "@agenter/client-sdk";

export interface NotePageIdentity {
  notebook: string;
  section: string;
  page: string;
}

export interface NotePageRow extends NotePageSummary {
  key: string;
}

export interface NoteSearchRow extends NoteSearchResult {
  key: string;
}

export interface NotePageResultBadge {
  label: string;
  title?: string;
}

export interface NotePageResultField {
  label: string;
  value: string;
}

export interface NotePageResultItem {
  key: string;
  identity: NotePageIdentity | null;
  title: string;
  subtitle?: string;
  description?: string;
  badges: NotePageResultBadge[];
  fields: NotePageResultField[];
  disabledReason?: string;
}

export const createNotePageKey = (identity: NotePageIdentity): string =>
  `${identity.notebook}/${identity.section}/${identity.page}`;

export const sameNotePageIdentity = (left: NotePageIdentity | null, right: NotePageIdentity | null): boolean =>
  Boolean(
    left && right && left.notebook === right.notebook && left.section === right.section && left.page === right.page,
  );

export const flattenNoteCatalog = (catalog: NoteCatalogOutput | null): NotePageRow[] =>
  catalog
    ? catalog.notebooks.flatMap((notebook) =>
        notebook.sections.flatMap((section) =>
          section.pages.map((page) => ({
            ...page,
            key: createNotePageKey(page),
          })),
        ),
      )
    : [];

export const mapNoteSearchRows = (results: readonly NoteSearchResult[]): NoteSearchRow[] =>
  results.map((result) => ({
    ...result,
    key: createNotePageKey(result),
  }));

export const mapNoteSearchResultItems = (results: readonly NoteSearchRow[]): NotePageResultItem[] =>
  results.map((result) => ({
    key: result.key,
    identity: {
      notebook: result.notebook,
      section: result.section,
      page: result.page,
    },
    title: result.page,
    subtitle: `${result.notebook} / ${result.section}`,
    description: result.snippet,
    badges: [{ label: `score ${result.score.toFixed(2)}` }, ...result.tags.map((tag) => ({ label: tag }))],
    fields: [
      { label: "Book ID", value: result.bookId },
      { label: "Section ID", value: result.sectionId },
      { label: "Page ID", value: result.pageId },
    ],
  }));

const normalizeSqlColumnName = (name: string): string => name.trim().toLowerCase();

const findSqlColumnName = (columns: readonly string[], candidates: readonly string[]): string | null => {
  const normalizedCandidates = new Set(candidates.map(normalizeSqlColumnName));
  return columns.find((column) => normalizedCandidates.has(normalizeSqlColumnName(column))) ?? null;
};

const stringifySqlValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value) ?? String(value);
};

const readSqlStringValue = (
  row: Record<string, unknown>,
  columns: readonly string[],
  candidates: readonly string[],
): string | null => {
  const column = findSqlColumnName(columns, candidates);
  if (!column) {
    return null;
  }
  const value = stringifySqlValue(row[column]).trim();
  return value.length > 0 ? value : null;
};

const createSqlField = (
  row: Record<string, unknown>,
  columns: readonly string[],
  candidates: readonly string[],
  label: string,
): NotePageResultField | null => {
  const value = readSqlStringValue(row, columns, candidates);
  return value ? { label, value } : null;
};

export const mapNoteSqlResultItems = (output: NoteSqlQueryOutput | null): NotePageResultItem[] => {
  if (!output) {
    return [];
  }
  const identityColumns = {
    notebook: findSqlColumnName(output.columns, ["notebook", "book", "notebookName"]),
    section: findSqlColumnName(output.columns, ["section", "sectionName"]),
    page: findSqlColumnName(output.columns, ["page", "pageName", "name", "title"]),
  };
  return output.rows.map((row, index) => {
    const notebook = readSqlStringValue(row, output.columns, ["notebook", "book", "notebookName"]);
    const section = readSqlStringValue(row, output.columns, ["section", "sectionName"]);
    const page = readSqlStringValue(row, output.columns, ["page", "pageName", "name", "title"]);
    const identity = notebook && section && page ? { notebook, section, page } : null;
    const mime = readSqlStringValue(row, output.columns, ["mime", "mimeType"]);
    const description = readSqlStringValue(row, output.columns, ["preview", "snippet", "body", "content"]) ?? undefined;
    const firstUpdatedAtField = createSqlField(row, output.columns, ["updatedAt", "updated_at", "modifiedAt", "modified_at"], "updatedAt");
    const consumedColumns = [
      ...Object.values(identityColumns),
      findSqlColumnName(output.columns, ["mime", "mimeType"]),
      findSqlColumnName(output.columns, ["updatedAt", "updated_at", "modifiedAt", "modified_at"]),
      findSqlColumnName(output.columns, ["preview", "snippet", "body", "content"]),
    ].filter((column): column is string => Boolean(column));
    const fields = output.columns
      .filter((column) => !consumedColumns.includes(column))
      .map((column) => ({ label: column, value: stringifySqlValue(row[column]) }))
      .filter((field) => field.value.length > 0);
    const visibleFields = [firstUpdatedAtField, ...fields].filter((field): field is NotePageResultField =>
      Boolean(field),
    );

    return {
      key: identity ? createNotePageKey(identity) : `query:${index}:${JSON.stringify(row)}`,
      identity,
      title: identity?.page ?? `Row ${index + 1}`,
      subtitle: identity ? `${identity.notebook} / ${identity.section}` : undefined,
      description,
      badges: mime ? [{ label: mime }] : [],
      fields: visibleFields,
      disabledReason: identity ? undefined : "This row does not include notebook, section, and page columns.",
    };
  });
};

export const firstNotePageIdentity = (catalog: NoteCatalogOutput | null): NotePageIdentity | null => {
  const firstPage = catalog?.notebooks[0]?.sections[0]?.pages[0] ?? null;
  return firstPage
    ? {
        notebook: firstPage.notebook,
        section: firstPage.section,
        page: firstPage.page,
      }
    : null;
};

export const firstNoteNotebookName = (notebooks: NoteNotebookListOutput | null): string | null =>
  notebooks?.notebooks[0]?.notebook ?? null;

export const firstNoteSectionName = (sections: NoteSectionListOutput | null): string | null =>
  sections?.sections[0]?.section ?? null;

export const firstNotePageListIdentity = (pages: NotePageListOutput | null): NotePageIdentity | null => {
  const firstPage = pages?.pages[0] ?? null;
  return firstPage
    ? {
        notebook: firstPage.notebook,
        section: firstPage.section,
        page: firstPage.page,
      }
    : null;
};

export const hasNoteCapability = (projection: { capability?: { available: boolean } } | null): boolean =>
  projection?.capability?.available === true;
