export type NoteWriteMode = "append" | "override";
export type NoteMime = "text/markdown" | "application/json" | string;

export interface NoteIdentity {
  notebook: string;
  section: string;
  page: string;
}

export interface NoteReference {
  label?: string;
  uri: string;
  bookId: string;
  sectionId: string;
  pageId: string;
  notebook: string;
  section: string;
  page: string;
}

export type NoteReferenceInput =
  | string
  | {
      label?: string;
      uri?: string;
      bookId?: string;
      sectionId?: string;
      pageId?: string;
      notebook?: string;
      section?: string;
      page?: string;
      path?: string;
    };

export interface NoteContentDescriptor {
  inline: boolean;
  sizeBytes: number;
  sourcePath?: string;
}

export interface NoteMetadata extends NoteIdentity {
  id: string;
  bookId: string;
  sectionId: string;
  pageId: string;
  kind: "note";
  createdAt: string;
  updatedAt: string;
  mime: NoteMime;
  tags: string[];
  tagIds: string[];
  references: NoteReference[];
  sourceWorkspace?: string;
}

export interface NotePage {
  identity: NoteIdentity;
  metadata: NoteMetadata;
  path: string;
  body: string;
  content: NoteContentDescriptor;
}

export interface NoteCapabilityState {
  available: boolean;
  readableRoots: string[];
  writableRoot: string | null;
}

export interface NoteAvatarContext {
  nickname: string;
  principalId: string | null;
  avatarHome: string[];
}

export interface NotePageSummary extends NoteIdentity {
  path: string;
  id: string;
  bookId: string;
  sectionId: string;
  pageId: string;
  createdAt: string;
  updatedAt: string;
  mime: NoteMime;
  tags: string[];
  tagIds: string[];
  referenceCount: number;
  sourceWorkspace?: string;
  preview: string;
}

export interface NoteSectionGroup {
  section: string;
  pages: NotePageSummary[];
}

export interface NoteNotebookGroup {
  notebook: string;
  sections: NoteSectionGroup[];
}

export interface NoteCatalogOutput {
  capability: NoteCapabilityState;
  notebooks: NoteNotebookGroup[];
  totalPages: number;
}

export interface NotePageOutput {
  capability: NoteCapabilityState;
  page: NotePage | null;
}

export interface NoteSearchOutput {
  capability: NoteCapabilityState;
  results: NoteSearchResult[];
}

export interface NoteWriteInput extends NoteIdentity {
  avatarHome: readonly string[];
  body?: string;
  mode?: NoteWriteMode;
  mime?: NoteMime;
  tags?: readonly string[];
  references?: readonly NoteReferenceInput[];
  sourcePath?: string;
  now?: Date;
  sourceWorkspace?: string;
}

export interface NoteDraftInput {
  avatarHome: readonly string[];
  body: string;
  now?: Date;
  idSuffix?: string;
  sourceWorkspace?: string;
}

export interface NoteReadInput extends NoteIdentity {
  avatarHome: readonly string[];
}

export interface NoteListInput {
  avatarHome: readonly string[];
  notebook?: string;
  section?: string;
  limit?: number;
}

export interface NoteSearchInput {
  avatarHome: readonly string[];
  query: string;
  limit?: number;
  tags?: readonly string[];
}

export interface NoteSearchResult extends NoteIdentity {
  id: string;
  bookId: string;
  sectionId: string;
  pageId: string;
  path: string;
  score: number;
  snippet: string;
  tags: string[];
  references: NoteReference[];
}

export interface NoteTagSummary {
  id: string;
  name: string;
  count: number;
}

export interface NoteTagQueryInput {
  avatarHome: readonly string[];
  notebook?: string;
  section?: string;
}

export interface NoteTagQueryOutput {
  capability: NoteCapabilityState;
  tags: NoteTagSummary[];
}

export interface NoteSqlQueryInput {
  avatarHome: readonly string[];
  sql: string;
  limit?: number;
}

export interface NoteSqlQueryOutput {
  capability: NoteCapabilityState;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface NoteRenameInput {
  avatarHome: readonly string[];
  notebook: string;
  section: string;
  page?: string;
  toNotebook?: string;
  toSection?: string;
  toPage?: string;
}

export interface NoteRenameOutput {
  capability: NoteCapabilityState;
  pages: NotePage[];
}

export interface NoteCliCapabilityProjection {
  command: "note";
  capability: "avatar-private";
  writableRoot: string;
}
