export type NoteWriteMode = "append" | "override";

export interface NoteIdentity {
  notebook: string;
  section: string;
  page: string;
}

export interface NoteMetadata extends NoteIdentity {
  id: string;
  kind: "note";
  createdAt: string;
  updatedAt: string;
  tags: string[];
  sourceWorkspace?: string;
}

export interface NotePage {
  identity: NoteIdentity;
  metadata: NoteMetadata;
  path: string;
  body: string;
}

export interface NoteWriteInput extends NoteIdentity {
  avatarHome: readonly string[];
  body: string;
  mode?: NoteWriteMode;
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
}

export interface NoteSearchResult extends NoteIdentity {
  path: string;
  score: number;
  snippet: string;
}

export interface NoteCliCapabilityProjection {
  command: "note";
  capability: "avatar-private";
  writableRoot: string;
}
