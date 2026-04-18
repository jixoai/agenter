import { z } from "zod";

import { stableStringify } from "./loopbus-kernel";

export const authDraftIdSchema = z.string().uuid();
export const authDraftKindSchema = z.enum(["avatar_create"]);

export type AuthDraftKind = z.infer<typeof authDraftKindSchema>;

const normalizeDraftText = (value: string | null | undefined, maxLength: number): string => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
};

export const avatarCreateDraftStateSchema = z.object({
  nickname: z.string().max(64),
  sourceAvatarNickname: z.string().max(64),
});

export interface AvatarCreateDraftState {
  nickname: string;
  sourceAvatarNickname: string;
}

export interface AuthDraftStateByKind {
  avatar_create: AvatarCreateDraftState;
}

export type AuthDraftState = AuthDraftStateByKind[AuthDraftKind];

export type AuthDraftWriteInput =
  | {
      kind: "avatar_create";
      state: AvatarCreateDraftState;
    };

export interface AuthDraftEntry<K extends AuthDraftKind = AuthDraftKind> {
  draftId: string;
  kind: K;
  state: AuthDraftStateByKind[K];
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface AuthDraftFilter {
  kind?: AuthDraftKind;
  draftIds?: string[];
}

export const authDraftFilterSchema = z
  .object({
    kind: authDraftKindSchema.optional(),
    draftIds: z.array(authDraftIdSchema).min(1).max(200).optional(),
  })
  .refine((value) => !(value.kind && value.draftIds), {
    message: "kind and draftIds are mutually exclusive",
    path: ["draftIds"],
  });

export interface AuthDraftSnapshot {
  lastEventId: number;
  items: AuthDraftEntry[];
}

export type AuthDraftEvent =
  | {
      eventId: number;
      timestamp: number;
      kind: "upsert";
      entry: AuthDraftEntry;
    }
  | {
      eventId: number;
      timestamp: number;
      kind: "delete";
      draftId: string;
      draftKind: AuthDraftKind;
      version: number;
    };

export interface AuthDraftCreateResult {
  eventId: number;
  entry: AuthDraftEntry;
}

export type AuthDraftSaveResult =
  | {
      ok: true;
      changed: boolean;
      eventId: number | null;
      entry: AuthDraftEntry;
    }
  | {
      ok: false;
      reason: "not_found" | "conflict";
      latest: AuthDraftEntry | null;
    };

export type AuthDraftDeleteResult =
  | {
      ok: true;
      removed: boolean;
      eventId: number | null;
      draftId: string;
      kind: AuthDraftKind | null;
      version: number | null;
    }
  | {
      ok: false;
      reason: "not_found" | "conflict";
      latest: AuthDraftEntry | null;
    };

export const authDraftCreateInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("avatar_create"),
    state: avatarCreateDraftStateSchema,
  }),
]);

export const authDraftSaveInputSchema = z.discriminatedUnion("kind", [
  z.object({
    draftId: authDraftIdSchema,
    kind: z.literal("avatar_create"),
    state: avatarCreateDraftStateSchema,
    baseVersion: z.number().int().positive().optional(),
  }),
]);

export const authDraftDeleteInputSchema = z.object({
  draftId: authDraftIdSchema,
  baseVersion: z.number().int().positive().optional(),
});

export const authDraftGetInputSchema = z.object({
  draftId: authDraftIdSchema,
});

export const authDraftEventsInputSchema = authDraftFilterSchema
  .extend({
    afterEventId: z.number().int().nonnegative().optional(),
  })
  .optional();

const normalizeAvatarCreateDraftState = (input: AvatarCreateDraftState): AvatarCreateDraftState => ({
  nickname: normalizeDraftText(input.nickname, 64),
  sourceAvatarNickname: normalizeDraftText(input.sourceAvatarNickname, 64),
});

export const normalizeAuthDraftWriteInput = (input: AuthDraftWriteInput): AuthDraftWriteInput => {
  if (input.kind === "avatar_create") {
    return {
      kind: "avatar_create",
      state: normalizeAvatarCreateDraftState(input.state),
    };
  }
  return input;
};

export const normalizeAuthDraftFilter = (filter: AuthDraftFilter | null | undefined): AuthDraftFilter => {
  if (!filter) {
    return {};
  }
  if (filter.kind && filter.draftIds) {
    throw new Error("kind and draftIds are mutually exclusive");
  }
  if (filter.draftIds) {
    const seen = new Set<string>();
    const draftIds: string[] = [];
    for (const draftId of filter.draftIds) {
      if (seen.has(draftId)) {
        continue;
      }
      seen.add(draftId);
      draftIds.push(draftId);
    }
    return { draftIds };
  }
  return filter.kind ? { kind: filter.kind } : {};
};

export const matchesAuthDraftFilter = (
  entry: { draftId: string; kind: AuthDraftKind },
  filter: AuthDraftFilter | null | undefined,
): boolean => {
  const normalized = normalizeAuthDraftFilter(filter);
  if (normalized.draftIds) {
    return normalized.draftIds.includes(entry.draftId);
  }
  if (normalized.kind) {
    return entry.kind === normalized.kind;
  }
  return true;
};

export const parseAuthDraftState = (kind: AuthDraftKind, value: unknown): AuthDraftState => {
  if (kind === "avatar_create") {
    return normalizeAvatarCreateDraftState(avatarCreateDraftStateSchema.parse(value));
  }
  const unsupportedKind: never = kind;
  throw new Error(`unsupported auth draft kind: ${unsupportedKind}`);
};

export const stableSerializeAuthDraftState = (kind: AuthDraftKind, value: AuthDraftState): string =>
  stableStringify(parseAuthDraftState(kind, value));
