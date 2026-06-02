import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";

import {
  appAttentionCommitInputSchema,
  appAttentionQueryInputSchema,
  appAttentionSettleInputSchema,
  appAvatarPromptSeedInputSchema,
  appPrivateTextAssetEnsureInputSchema,
} from "@agenter/app-runtime";
import { AVATAR_CLASSIFY_VALUES } from "@agenter/auth-service";
import type { MessageContactId } from "@agenter/message-system";
import { isPrincipalId } from "@agenter/principal-crypto";
import { TERMINAL_BACKEND_KINDS, type TerminalActorId } from "@agenter/terminal-system";
import {
  authDraftCreateInputSchema,
  authDraftDeleteInputSchema,
  authDraftEventsInputSchema,
  authDraftFilterSchema,
  authDraftGetInputSchema,
  authDraftSaveInputSchema,
  matchesAuthDraftFilter,
  type AuthDraftEvent,
} from "../auth-draft-types";
import {
  authKvFilterSchema,
  authKvKeySchema,
  jsonValueSchema,
  matchesAuthKvFilter,
  type AuthKvEvent,
} from "../auth-kv-types";
import type { AnyRuntimeEvent } from "../realtime-types";
import { settingsKindSchema } from "../realtime-types";
import { t } from "./init";

const sessionIdInput = z.object({ sessionId: z.string().min(1) });
const reverseTimeCursorSchema = z.object({
  beforeTimeMs: z.number().int().nonnegative(),
  beforeId: z.number().int().positive(),
});
const reversePageInput = z.object({
  sessionId: z.string().min(1),
  before: reverseTimeCursorSchema.optional(),
  limit: z.number().int().positive().max(500).optional(),
});
const usageAnalyticsInput = z
  .object({
    sessionId: z.string().min(1),
    sinceMs: z.number().int().nonnegative(),
    untilMs: z.number().int().nonnegative(),
    granularity: z.enum(["auto", "raw", "day", "month", "year"]).optional(),
    filters: z
      .object({
        sessionId: z.string().min(1).optional(),
        kind: z.string().min(1).optional(),
        providerId: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
      })
      .optional(),
  })
  .refine((value) => value.untilMs >= value.sinceMs, {
    message: "untilMs must be greater than or equal to sinceMs",
    path: ["untilMs"],
  });
const channelAccessInput = z.object({
  chatId: z.string().min(1),
  accessToken: z.string().min(1),
});
const messageQueryInputSchema = z.object({
  chatId: z.union([z.string().min(1), z.array(z.string().min(1)).min(1), z.literal("*")]),
  mode: z.enum(["match", "query", "sql"]),
  query: z.string().trim().min(1),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(100).optional(),
});
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;
const MESSAGE_CONTACT_ID_PATTERN = /^(auth|session|system):.+$/;
const TERMINAL_ACTOR_ID_PATTERN = /^(auth|session|system):.+$/;
const messageContactIdSchema = z.custom<MessageContactId>(
  (value) => typeof value === "string" && (MESSAGE_CONTACT_ID_PATTERN.test(value) || isPrincipalId(value)),
  {
    message: "message actor id must be a principal id or start with auth:, session:, or system:",
  },
);
const terminalActorIdSchema = z.custom<TerminalActorId>(
  (value) => typeof value === "string" && (TERMINAL_ACTOR_ID_PATTERN.test(value) || isPrincipalId(value)),
  {
    message: "terminal actor id must be a principal id or start with auth:, session:, or system:",
  },
);
const terminalProcessProfileSchema = z.object({
  command: z.array(z.string().min(1)).min(1).optional(),
  cwd: z.string().min(1).optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  gitLog: z.union([z.literal(false), z.literal("none"), z.literal("normal"), z.literal("verbose")]).optional(),
  logStyle: z.union([z.literal("plain"), z.literal("rich")]).optional(),
  icon: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  shortcuts: z.record(z.string(), z.string().min(1)).optional(),
});
const terminalBackendSchema = z.enum(TERMINAL_BACKEND_KINDS);
const terminalConfigPatchSchema = z.object({
  terminalId: z.string().min(1),
  processKind: z.string().trim().min(1).optional(),
  backend: terminalBackendSchema.optional(),
  command: z.array(z.string().min(1)).min(1).optional(),
  launchCwd: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  gitLog: z.union([z.literal(false), z.literal("none"), z.literal("normal"), z.literal("verbose")]).optional(),
  logStyle: z.union([z.literal("plain"), z.literal("rich")]).optional(),
  title: z.string().trim().min(1).optional(),
  icon: z.string().trim().min(1).optional(),
  shortcuts: z.record(z.string(), z.string().min(1)).optional(),
  rendererPreference: z.enum(["auto", "ghostty-web", "wterm", "xterm"]).optional(),
  theme: z.enum(["default-dark", "default-light", "monokai"]).optional(),
  cursor: z.enum(["block", "bar", "underline"]).optional(),
  font: z
    .object({
      family: z.string().min(1),
      sizePx: z.number().positive(),
      lineHeight: z.number().positive(),
      letterSpacing: z.number(),
      weight: z.string().min(1),
      weightBold: z.string().min(1),
      ligatures: z.boolean(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const terminalComposedSurfaceSchema = z.object({
  terminalId: z.string().min(1),
  surface: z.object({
    shellTerminalId: z.string().min(1),
    terminalId: z.string().min(1),
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
    seq: z.number().int().optional(),
    lines: z.array(z.string()),
    richLines: z
      .array(
        z.object({
          spans: z.array(
            z.object({
              text: z.string(),
              fg: z.string().optional(),
              bg: z.string().optional(),
              bold: z.boolean().optional(),
              underline: z.boolean().optional(),
              inverse: z.boolean().optional(),
            }),
          ),
        }),
      )
      .optional(),
    selectionSources: z
      .array(
        z.object({
          owner: z.string().min(1),
          row: z.number().int().nonnegative(),
          col: z.number().int().nonnegative(),
          width: z.number().int().nonnegative(),
          height: z.number().int().nonnegative(),
          sourceStartRow: z.number().int().nonnegative().optional(),
        }),
      )
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    cursor: z.object({
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
      visible: z.boolean().optional(),
    }),
    scrollback: z.object({
      viewportOffset: z.number().int().nonnegative(),
      totalLines: z.number().int().nonnegative(),
      screenLines: z.number().int().positive(),
    }),
  }),
});
const workspaceGrantInputSchema = z.object({
  pattern: z.string().trim().min(1),
  mode: z.enum(["ro", "rw"]),
});
const skillCatalogRootKindSchema = z.enum(["builtin", "shared", "global", "skills-home"]);
const skillTreeInputSchema = z.object({
  name: z.string().trim().min(1),
  path: z.string().optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});
const skillPreviewInputSchema = z.object({
  name: z.string().trim().min(1),
  path: z.string().trim().min(1),
  maxBytes: z
    .number()
    .int()
    .positive()
    .max(4 * 1024 * 1024)
    .optional(),
});
const noteAvatarInputSchema = z.object({
  avatarNickname: z.string().trim().min(1).optional(),
});
const noteIdentityInputSchema = noteAvatarInputSchema.extend({
  notebook: z.string().trim().min(1),
  section: z.string().trim().min(1),
  page: z.string().trim().min(1),
});
const noteCatalogInputSchema = noteAvatarInputSchema
  .extend({
    limit: z.number().int().positive().max(1000).optional(),
  })
  .optional();
const noteSearchInputSchema = noteAvatarInputSchema.extend({
  query: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});
const noteTagsInputSchema = noteAvatarInputSchema.extend({
  notebook: z.string().trim().min(1).optional(),
  section: z.string().trim().min(1).optional(),
});
const noteSqlQueryInputSchema = noteAvatarInputSchema.extend({
  sql: z.string().trim().min(1),
  limit: z.number().int().positive().max(200).optional(),
});
const noteReferenceInputSchema = z.union([
  z.string().trim().min(1),
  z
    .object({
      label: z.string().trim().min(1).optional(),
      uri: z.string().trim().min(1).optional(),
      bookId: z.string().trim().min(1).optional(),
      sectionId: z.string().trim().min(1).optional(),
      pageId: z.string().trim().min(1).optional(),
      notebook: z.string().trim().min(1).optional(),
      section: z.string().trim().min(1).optional(),
      page: z.string().trim().min(1).optional(),
      path: z.string().trim().min(1).optional(),
    })
    .strict(),
]);
const noteRenameInputSchema = noteAvatarInputSchema.extend({
  notebook: z.string().trim().min(1),
  section: z.string().trim().min(1),
  page: z.string().trim().min(1).optional(),
  toNotebook: z.string().trim().min(1).optional(),
  toSection: z.string().trim().min(1).optional(),
  toPage: z.string().trim().min(1).optional(),
});
const noteWriteInputSchema = noteIdentityInputSchema
  .extend({
    content: z.string().optional(),
    contentFile: z.string().trim().min(1).optional(),
    mode: z.enum(["append", "override"]).optional(),
    mime: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)).optional(),
    references: z.array(noteReferenceInputSchema).optional(),
  })
  .refine((input) => (input.content !== undefined) !== (input.contentFile !== undefined), {
    message: "note write requires exactly one content source: content or contentFile",
    path: ["content"],
  });
const messageErrorPayloadSchema = z.object({
  title: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  detail: z.string().trim().min(1).optional(),
});
const messageInteractiveFieldSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  multiline: z.boolean().optional(),
  initialValue: z.string().optional(),
});
const messageInteractivePayloadSchema = z.object({
  version: z.literal("v1"),
  kind: z.literal("form"),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  submitLabel: z.string().trim().min(1).optional(),
  fields: z.array(messageInteractiveFieldSchema).min(1),
});
const messageSourceSubscriptionInputSchema = z.object({
  sourceId: z.string().trim().min(1),
  label: z.string().trim().min(1).optional(),
  endpoint: z.string().trim().min(1),
  authToken: z.string().trim().min(1).optional(),
  callbackSourceId: z.string().trim().min(1).optional(),
  callbackEndpoint: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const messageContactRequestStateSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "revoked",
  "expired",
  "superseded",
]);
const profileMetadataPatchSchema = z
  .object({
    nickname: z.string().trim().min(1).max(64).optional(),
    displayName: z.string().trim().min(1).max(128).optional(),
    phone: z.string().trim().min(1).max(64).optional(),
    address: z.string().trim().min(1).max(256).optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
const authChallengeStartInput = z.object({
  authId: z.string().trim().min(1),
});
const authChallengeVerifyInput = z.object({
  challengeId: z.string().uuid(),
  signature: z.string().trim().min(1),
});
const authKvBaseVersionSchema = z.number().int().positive().nullable().optional();
const authKvSnapshotInputSchema = authKvFilterSchema.optional();
const authKvSetInputSchema = z.object({
  key: authKvKeySchema,
  value: jsonValueSchema,
  baseVersion: authKvBaseVersionSchema,
});
const authKvDeleteInputSchema = z.object({
  key: authKvKeySchema,
  baseVersion: authKvBaseVersionSchema,
});
const authKvEventsInputSchema = authKvFilterSchema
  .extend({
    afterEventId: z.number().int().nonnegative().optional(),
  })
  .optional();
const authDraftListInputSchema = authDraftFilterSchema.optional();

const requireAuth = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "auth token required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
    },
  });
});

const requireSuperadmin = requireAuth.use(({ ctx, next }) => {
  if (!ctx.auth.claims.superadmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "superadmin auth required",
    });
  }
  return next();
});

const publicProcedure = t.procedure;
const authProcedure = requireAuth;
const superadminProcedure = requireSuperadmin;

const resolveTerminalCallerScope = (
  auth: { claims: { authId: string; superadmin: boolean } } | null | undefined,
): { actorId?: TerminalActorId; superadminActorId?: TerminalActorId } => {
  if (!auth?.claims.authId) {
    return {};
  }
  const actorId = `auth:${auth.claims.authId}` as TerminalActorId;
  return auth.claims.superadmin ? { superadminActorId: actorId } : { actorId };
};

const resolveMessageCallerScope = (
  auth: { claims: { authId: string; superadmin: boolean } } | null | undefined,
): { actorId?: MessageContactId; superadminContactId?: MessageContactId } => {
  if (!auth?.claims.authId) {
    return {};
  }
  const actorId = `auth:${auth.claims.authId}` as MessageContactId;
  return auth.claims.superadmin ? { superadminContactId: actorId } : { actorId };
};

const resolveAuthedMessageContactId = (auth: { claims: { authId: string } }): MessageContactId =>
  `auth:${auth.claims.authId}` as MessageContactId;

export const appRouter = t.router({
  auth: t.router({
    service: publicProcedure.query(async ({ ctx }) => await ctx.kernel.getAuthServiceDescriptor()),
    actors: superadminProcedure.query(async ({ ctx }) => ({ items: await ctx.kernel.listAuthActors() })),
    catalog: authProcedure
      .input(
        z
          .object({
            query: z.string().trim().min(1).optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const query = input?.query?.trim().toLowerCase();
        const items = await ctx.kernel.listAuthActors();
        if (!query) {
          return { items };
        }
        return {
          items: items.filter((item) =>
            [item.actorId, item.label, item.subtitle].some((value) => value.toLowerCase().includes(query)),
          ),
        };
      }),
    challengeStart: publicProcedure
      .input(authChallengeStartInput)
      .mutation(async ({ ctx, input }) => await ctx.kernel.startAuthChallenge(input.authId)),
    autoLogin: publicProcedure.mutation(async ({ ctx }) => await ctx.kernel.autoLoginBrowserAuth()),
    storeAutoLoginKey: publicProcedure
      .input(
        z
          .object({
            privateKey: z.string().trim().min(1).optional(),
          })
          .optional(),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.storeBrowserAutoLoginKey(input)),
    challengeVerify: publicProcedure
      .input(authChallengeVerifyInput)
      .mutation(
        async ({ ctx, input }) =>
          await ctx.kernel.verifyAuthChallenge({ ...input, token: ctx.auth?.token ?? undefined }),
      ),
    session: authProcedure.query(({ ctx }) => ctx.auth),
    superadminStatus: superadminProcedure.query(({ ctx }) => ({
      ok: true,
      claims: ctx.auth.claims,
    })),
  }),
  kv: t.router({
    snapshot: authProcedure.input(authKvSnapshotInputSchema).query(({ ctx, input }) => {
      return ctx.kernel.snapshotAuthKv(ctx.auth.claims.authId, input);
    }),
    set: authProcedure.input(authKvSetInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.setAuthKv(ctx.auth.claims.authId, input);
    }),
    delete: authProcedure.input(authKvDeleteInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.deleteAuthKv(ctx.auth.claims.authId, input);
    }),
    events: authProcedure.input(authKvEventsInputSchema).subscription(({ ctx, input }) => {
      return observable<AuthKvEvent>((emit) => {
        let cursor = input?.afterEventId ?? 0;
        const filter = input ? { keys: input.keys, prefix: input.prefix } : undefined;
        const pushEvent = (event: AuthKvEvent): void => {
          if (event.eventId <= cursor) {
            return;
          }
          const key = event.kind === "set" ? event.entry.key : event.key;
          if (!matchesAuthKvFilter(key, filter)) {
            return;
          }
          cursor = event.eventId;
          emit.next(event);
        };

        const unsubscribe = ctx.kernel.onAuthKvEvent(ctx.auth.claims.authId, pushEvent);
        for (const event of ctx.kernel.getAuthKvEventsAfter(ctx.auth.claims.authId, cursor, input)) {
          pushEvent(event);
        }
        return unsubscribe;
      });
    }),
  }),
  drafts: t.router({
    list: authProcedure.input(authDraftListInputSchema).query(({ ctx, input }) => {
      return ctx.kernel.listAuthDrafts(ctx.auth.claims.authId, input);
    }),
    get: authProcedure.input(authDraftGetInputSchema).query(({ ctx, input }) => {
      return ctx.kernel.getAuthDraft(ctx.auth.claims.authId, input.draftId);
    }),
    create: authProcedure.input(authDraftCreateInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.createAuthDraft(ctx.auth.claims.authId, input);
    }),
    save: authProcedure.input(authDraftSaveInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.saveAuthDraft(ctx.auth.claims.authId, input);
    }),
    delete: authProcedure.input(authDraftDeleteInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.deleteAuthDraft(ctx.auth.claims.authId, input);
    }),
    events: authProcedure.input(authDraftEventsInputSchema).subscription(({ ctx, input }) => {
      return observable<AuthDraftEvent>((emit) => {
        let cursor = input?.afterEventId ?? 0;
        const filter = input ? { kind: input.kind, draftIds: input.draftIds } : undefined;
        const pushEvent = (event: AuthDraftEvent): void => {
          if (event.eventId <= cursor) {
            return;
          }
          const entry =
            event.kind === "upsert"
              ? {
                  draftId: event.entry.draftId,
                  kind: event.entry.kind,
                }
              : {
                  draftId: event.draftId,
                  kind: event.draftKind,
                };
          if (!matchesAuthDraftFilter(entry, filter)) {
            return;
          }
          cursor = event.eventId;
          emit.next(event);
        };

        const unsubscribe = ctx.kernel.onAuthDraftEvent(ctx.auth.claims.authId, pushEvent);
        for (const event of ctx.kernel.getAuthDraftEventsAfter(ctx.auth.claims.authId, cursor, input)) {
          pushEvent(event);
        }
        return unsubscribe;
      });
    }),
  }),
  avatar: t.router({
    catalog: superadminProcedure.query(async ({ ctx }) => ({
      items: await ctx.kernel.listGlobalAvatarCatalog(),
    })),
    create: superadminProcedure
      .input(
        z.object({
          nickname: z.string().trim().min(1).max(64),
          displayName: z.string().trim().min(1).max(128).nullable().optional(),
          classify: z.enum(AVATAR_CLASSIFY_VALUES).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        avatar: await ctx.kernel.createGlobalAvatar(input),
      })),
  }),
  skill: t.router({
    catalog: superadminProcedure
      .input(
        z.object({
          rootKind: skillCatalogRootKindSchema,
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listSkillBrowserCatalog(input),
      })),
    avatarCatalog: superadminProcedure.query(async ({ ctx }) => ({
      items: await ctx.kernel.listSkillBrowserAvatarCatalog(),
    })),
    catalogTree: superadminProcedure
      .input(
        z
          .object({
            rootKind: skillCatalogRootKindSchema,
          })
          .extend(skillTreeInputSchema.shape),
      )
      .query(({ ctx, input }) => ctx.kernel.listSkillBrowserCatalogTree(input)),
    catalogPreview: superadminProcedure
      .input(
        z
          .object({
            rootKind: skillCatalogRootKindSchema,
          })
          .extend(skillPreviewInputSchema.shape),
      )
      .query(({ ctx, input }) => ctx.kernel.readSkillBrowserCatalogPreview(input)),
    avatarTree: superadminProcedure
      .input(
        z
          .object({
            avatarNickname: z.string().trim().min(1),
            workspacePath: z.string().trim().min(1),
          })
          .extend(skillTreeInputSchema.shape),
      )
      .query(({ ctx, input }) => ctx.kernel.listSkillBrowserAvatarTree(input)),
    avatarPreview: superadminProcedure
      .input(
        z
          .object({
            avatarNickname: z.string().trim().min(1),
            workspacePath: z.string().trim().min(1),
          })
          .extend(skillPreviewInputSchema.shape),
      )
      .query(({ ctx, input }) => ctx.kernel.readSkillBrowserAvatarPreview(input)),
  }),
  note: t.router({
    catalog: superadminProcedure
      .input(noteCatalogInputSchema)
      .query(async ({ ctx, input }) => await ctx.kernel.listNoteCatalog(input ?? {})),
    page: superadminProcedure
      .input(noteIdentityInputSchema)
      .query(async ({ ctx, input }) => await ctx.kernel.readNotePage(input)),
    search: superadminProcedure
      .input(noteSearchInputSchema)
      .query(async ({ ctx, input }) => await ctx.kernel.searchNoteCatalog(input)),
    tags: superadminProcedure
      .input(noteTagsInputSchema.optional())
      .query(async ({ ctx, input }) => await ctx.kernel.listNoteTagCatalog(input ?? {})),
    query: superadminProcedure
      .input(noteSqlQueryInputSchema)
      .query(async ({ ctx, input }) => await ctx.kernel.queryNoteCatalogSql(input)),
    rename: superadminProcedure
      .input(noteRenameInputSchema)
      .mutation(async ({ ctx, input }) => await ctx.kernel.renameNoteCatalogPages(input)),
    write: superadminProcedure
      .input(noteWriteInputSchema)
      .mutation(async ({ ctx, input }) => await ctx.kernel.writeNoteCatalogPage(input)),
  }),
  session: t.router({
    list: superadminProcedure.query(({ ctx }) => ({ sessions: ctx.kernel.listSessions() })),
    create: superadminProcedure
      .input(
        z.object({
          cwd: z.string().min(1),
          name: z.string().optional(),
          avatar: z.string().optional(),
          autoStart: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const session = await ctx.kernel.createSession(input);
        return { session };
      }),
    update: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          name: z.string().optional(),
        }),
      )
      .mutation(({ ctx, input }) => {
        const session = ctx.kernel.updateSession(input.sessionId, {
          name: input.name,
        });
        return { session };
      }),
    delete: superadminProcedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      return await ctx.kernel.deleteSession(input.sessionId);
    }),
    start: superadminProcedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.startSession(input.sessionId);
      return { session };
    }),
    stop: superadminProcedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.stopSession(input.sessionId);
      return { session };
    }),
    abort: superadminProcedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.abortSession(input.sessionId);
      return { session };
    }),
    archive: superadminProcedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.archiveSession(input.sessionId);
      return { session };
    }),
    restore: superadminProcedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.restoreSession(input.sessionId);
      return { session };
    }),
    focusTerminal: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          terminalId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.focusTerminal(input.sessionId, input.terminalId)),
    cycles: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({ items: ctx.kernel.listCurrentBranchCycles(input.sessionId, input.limit ?? 200) })),
    rollback: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          cycleId: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.rollbackSessionCycle(input.sessionId, input.cycleId)),
  }),
  chat: t.router({
    send: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          text: z.string().min(1),
          assetIds: z.array(z.string().min(1)).optional(),
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendChat(input.sessionId, input.text, input.assetIds ?? [], input.clientMessageId),
      ),
    list: superadminProcedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageChatMessages(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    cycles: superadminProcedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageChatCycles(input.sessionId, { before: input.before, limit: input.limit ?? 120 }),
      ),
  }),
  message: t.router({
    listChannels: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          includeArchived: z.boolean().optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listMessageChannels(input.sessionId, { includeArchived: input.includeArchived }),
      })),
    createChannel: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          kind: z.literal("room"),
          title: z.string().trim().min(1).optional(),
          participants: z
            .array(
              z.object({
                id: z.string().trim().min(1),
                label: z.string().trim().min(1).optional(),
              }),
            )
            .optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          adminToken: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "adminToken must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
          focus: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        channel: await ctx.kernel.createMessageChannel({
          sessionId: input.sessionId,
          kind: input.kind,
          title: input.title,
          participants: input.participants,
          metadata: input.metadata,
          adminToken: input.adminToken,
          focus: input.focus,
        }),
      })),
    focus: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          op: z.enum(["add", "remove", "replace", "clear"]),
          channels: z.array(channelAccessInput).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        items: await ctx.kernel.focusMessageChannels({
          sessionId: input.sessionId,
          op: input.op,
          channels: input.channels,
        }),
      })),
    send: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          text: z.string().min(1),
          assetIds: z.array(z.string().min(1)).optional(),
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendMessageChannel({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          text: input.text,
          assetIds: input.assetIds,
          clientMessageId: input.clientMessageId,
        }),
      ),
    edit: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          messageId: z.number().int().positive(),
          text: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.editMessageChannel({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          messageId: input.messageId,
          text: input.text,
        }),
      ),
    recall: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          messageId: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.recallMessageChannel({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          messageId: input.messageId,
        }),
      ),
    sendError: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          content: z.string().trim().min(1),
          error: messageErrorPayloadSchema,
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendMessageChannelError({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          content: input.content,
          error: input.error,
          clientMessageId: input.clientMessageId,
        }),
      ),
    sendInteractive: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          content: z.string().trim().min(1),
          interactive: messageInteractivePayloadSchema,
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendMessageChannelInteractive({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          content: input.content,
          interactive: input.interactive,
          clientMessageId: input.clientMessageId,
        }),
      ),
    updateChannel: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          patch: z.object({
            title: z.string().trim().min(1).optional(),
            participants: z
              .array(
                z.object({
                  id: z.string().min(1),
                  label: z.string().trim().min(1).optional(),
                }),
              )
              .optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
          }),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.updateMessageChannel(input),
      })),
    archiveChannel: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          archivedBy: z.string().trim().min(1).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        channel: await ctx.kernel.archiveMessageChannel(input),
      })),
    deleteChannel: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.deleteMessageChannel(input),
      })),
    listChannelGrants: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listMessageChannelGrants(input),
      })),
    issueChannelGrant: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          role: z.enum(["admin", "member", "readonly"]),
          label: z.string().trim().min(1).optional(),
          participantId: z.string().trim().min(1).optional(),
          accessTokenHint: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "accessTokenHint must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        grant: ctx.kernel.issueMessageChannelGrant(input),
      })),
    revokeChannelGrant: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          grantId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.revokeMessageChannelGrant(input)),
    globalList: authProcedure
      .input(
        z.object({
          includeArchived: z.boolean().optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalRooms({
          includeArchived: input.includeArchived,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalCreate: authProcedure
      .input(
        z.object({
          chatId: z.string().trim().min(1).optional(),
          kind: z.literal("room").default("room"),
          title: z.string().trim().min(1).optional(),
          participants: z
            .array(
              z.object({
                id: z.string().trim().min(1),
                label: z.string().trim().min(1).optional(),
              }),
            )
            .optional(),
          initialUsers: z
            .array(
              z.object({
                contactId: messageContactIdSchema,
                label: z.string().trim().min(1).optional(),
                role: z.enum(["admin", "member", "readonly"]),
                focused: z.boolean().optional(),
              }),
            )
            .optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          adminToken: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "adminToken must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
          focus: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        channel: await ctx.kernel.createGlobalRoom({
          chatId: input.chatId,
          title: input.title,
          participants: input.participants,
          initialUsers: input.initialUsers,
          metadata: input.metadata,
          adminToken: input.adminToken,
          focus: input.focus,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalFocus: authProcedure
      .input(
        z.object({
          op: z.enum(["add", "remove", "replace", "clear"]),
          channels: z
            .array(
              z.object({
                chatId: z.string().min(1),
                accessToken: z.string().min(1).optional(),
              }),
            )
            .default([]),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.focusGlobalRooms({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalSnapshot: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.snapshotGlobalRoom({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalMarkRead: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          messageId: z.number().int().positive().optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.markGlobalRoomRead({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalPage: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          before: reverseTimeCursorSchema.optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.pageGlobalRoomMessages({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    query: authProcedure.input(messageQueryInputSchema).query(({ ctx, input }) =>
      ctx.kernel.queryGlobalRoomMessages({
        ...input,
        ...resolveMessageCallerScope(ctx.auth),
      }),
    ),
    globalSend: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          sendAsActorId: messageContactIdSchema.optional(),
          text: z.string().min(1),
          assetIds: z.array(z.string().min(1)).optional(),
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendGlobalRoomMessage({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalEdit: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          messageId: z.number().int().positive(),
          text: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.editGlobalRoomMessage({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalRecall: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          messageId: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.recallGlobalRoomMessage({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalUpdate: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          patch: z.object({
            title: z.string().trim().min(1).optional(),
            participants: z
              .array(
                z.object({
                  id: z.string().min(1),
                  label: z.string().trim().min(1).optional(),
                }),
              )
              .optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
            adminGroupCandidateIds: z.array(messageContactIdSchema).optional(),
          }),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.updateGlobalRoom({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalArchive: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          archivedBy: z.string().trim().min(1).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        channel: await ctx.kernel.archiveGlobalRoom({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalDelete: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.deleteGlobalRoom({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalListGrants: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalRoomGrants({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalListAssets: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalRoomAssets({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalIssueGrant: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          role: z.enum(["admin", "member", "readonly"]),
          label: z.string().trim().min(1).optional(),
          participantId: messageContactIdSchema,
          accessTokenHint: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "accessTokenHint must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        grant: ctx.kernel.issueGlobalRoomGrant({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalRevokeGrant: authProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          grantId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.revokeGlobalRoomGrant({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    sourceList: authProcedure.query(({ ctx }) => ({
      items: ctx.kernel.listMessageSourceSubscriptions({
        actorId: resolveAuthedMessageContactId(ctx.auth),
      }),
    })),
    sourceUpsert: authProcedure.input(messageSourceSubscriptionInputSchema).mutation(({ ctx, input }) => ({
      source: ctx.kernel.saveMessageSourceSubscription({
        actorId: resolveAuthedMessageContactId(ctx.auth),
        ...input,
      }),
    })),
    sourceDelete: authProcedure
      .input(
        z.object({
          sourceId: z.string().trim().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.deleteMessageSourceSubscription({
          actorId: resolveAuthedMessageContactId(ctx.auth),
          sourceId: input.sourceId,
        }),
      ),
    contactList: authProcedure.query(({ ctx }) => ({
      items: ctx.kernel.listMessageContacts({
        actorId: resolveAuthedMessageContactId(ctx.auth),
      }),
    })),
    contactRequestList: authProcedure
      .input(
        z
          .object({
            direction: z.enum(["inbound", "outbound"]).optional(),
            state: messageContactRequestStateSchema.optional(),
          })
          .optional(),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listMessageContactRequests({
          actorId: resolveAuthedMessageContactId(ctx.auth),
          direction: input?.direction,
          state: input?.state,
        }),
      })),
    contactSearch: authProcedure
      .input(
        z.object({
          sourceId: z.string().trim().min(1),
          query: z.string().trim().min(1).optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.searchMessageSourceActors({
          actorId: resolveAuthedMessageContactId(ctx.auth),
          sourceId: input.sourceId,
          query: input.query,
        }),
      ),
    contactRequestSend: authProcedure
      .input(
        z.object({
          sourceId: z.string().trim().min(1),
          remoteContactId: messageContactIdSchema,
          message: z.string().trim().min(1).optional(),
          expiresAt: z.number().int().positive().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        request: await ctx.kernel.sendMessageContactRequest({
          actorId: resolveAuthedMessageContactId(ctx.auth),
          sourceId: input.sourceId,
          remoteContactId: input.remoteContactId,
          message: input.message,
          expiresAt: input.expiresAt,
        }),
      })),
    receiveContactRequest: authProcedure
      .input(
        z.object({
          requestId: z.string().trim().min(1),
          sourceId: z.string().trim().min(1),
          remoteContactId: messageContactIdSchema,
          remoteLabel: z.string().trim().min(1).optional(),
          remoteSubtitle: z.string().trim().min(1).optional(),
          remoteIconUrl: z.string().trim().min(1).optional(),
          message: z.string().trim().min(1).optional(),
          callbackEndpoint: z.string().trim().min(1).optional(),
          expiresAt: z.number().int().positive().optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        request: ctx.kernel.receiveMessageContactRequest({
          actorId: resolveAuthedMessageContactId(ctx.auth),
          ...input,
        }),
      })),
    acceptContactRequest: authProcedure
      .input(
        z.object({
          requestId: z.string().trim().min(1),
          firstChat: z.string().trim().min(1).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        result: await ctx.kernel.acceptMessageContactRequest({
          actorId: resolveAuthedMessageContactId(ctx.auth),
          requestId: input.requestId,
          firstChat: input.firstChat,
        }),
      })),
    acceptContactRequestRemote: authProcedure
      .input(
        z.object({
          requestId: z.string().trim().min(1),
          remoteContactId: messageContactIdSchema,
          remoteLabel: z.string().trim().min(1).optional(),
          remoteSubtitle: z.string().trim().min(1).optional(),
          remoteIconUrl: z.string().trim().min(1).optional(),
          firstChat: z.string().trim().min(1).optional(),
          remoteDirectChatId: z.string().trim().min(1).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        result: await ctx.kernel.acceptContactRequestRemote({
          actorId: resolveAuthedMessageContactId(ctx.auth),
          ...input,
        }),
      })),
    inviteParticipant: authProcedure
      .input(
        z.object({
          chatId: z.string().trim().min(1),
          invitedContactId: messageContactIdSchema,
          invitedLabel: z.string().trim().min(1).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        room: await ctx.kernel.inviteAdditionalParticipantFromGlobalRoom({
          actorId: resolveAuthedMessageContactId(ctx.auth),
          ...input,
        }),
      })),
  }),
  terminal: t.router({
    list: superadminProcedure
      .input(sessionIdInput)
      .query(({ ctx, input }) => ({ items: ctx.kernel.listTerminals(input.sessionId) })),
    create: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          terminalId: z.string().min(1).optional(),
          processKind: z.string().trim().min(1).optional(),
          backend: terminalBackendSchema.optional(),
          command: z.array(z.string().min(1)).min(1).optional(),
          cwd: z.string().min(1).optional(),
          profile: terminalProcessProfileSchema.optional(),
          focus: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        result: await ctx.kernel.createTerminal(input),
      })),
    focus: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          op: z.enum(["add", "remove", "replace", "clear"]),
          terminalIds: z.array(z.string().min(1)).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.focusTerminals(input)),
    delete: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          terminalId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.deleteTerminal(input)),
    globalList: authProcedure.query(({ ctx }) => ({
      items: ctx.kernel.listGlobalTerminals(resolveTerminalCallerScope(ctx.auth)),
    })),
    globalHistory: authProcedure.query(({ ctx }) => ({
      items: ctx.kernel.listGlobalTerminalHistory(resolveTerminalCallerScope(ctx.auth)),
    })),
    globalIndex: authProcedure.query(({ ctx }) => ({
      items: ctx.kernel.listGlobalTerminalIndex(resolveTerminalCallerScope(ctx.auth)),
    })),
    globalArchiveList: authProcedure.query(({ ctx }) => ({
      items: ctx.kernel.listGlobalTerminalArchive(resolveTerminalCallerScope(ctx.auth)),
    })),
    globalCreate: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1).optional(),
          processKind: z.string().trim().min(1).optional(),
          backend: terminalBackendSchema.optional(),
          command: z.array(z.string().min(1)).min(1).optional(),
          cwd: z.string().min(1).optional(),
          profile: terminalProcessProfileSchema.optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          start: z.boolean().optional(),
          focus: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        result: await ctx.kernel.createGlobalTerminal({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    globalBootstrap: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          recoveryIntent: z.enum(["killed-history"]).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        result: ctx.kernel.bootstrapGlobalTerminal({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    globalStop: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        result: await ctx.kernel.stopGlobalTerminal({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    globalArchive: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ({
        terminal: ctx.kernel.archiveGlobalTerminal({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    globalFocus: authProcedure
      .input(
        z.object({
          op: z.enum(["add", "remove", "replace", "clear"]),
          terminalIds: z.array(z.string().min(1)).default([]),
          accessToken: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.focusGlobalTerminals({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    globalDelete: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
        }),
      )
      .mutation(
        async ({ ctx, input }) =>
          await ctx.kernel.deleteGlobalTerminal({
            ...input,
            ...resolveTerminalCallerScope(ctx.auth),
          }),
      ),
    globalSetConfig: authProcedure.input(terminalConfigPatchSchema).mutation(({ ctx, input }) => ({
      result: ctx.kernel.setGlobalTerminalConfig({
        ...input,
        ...resolveTerminalCallerScope(ctx.auth),
      }),
    })),
    globalPublishComposedSurface: authProcedure.input(terminalComposedSurfaceSchema).mutation(({ ctx, input }) => ({
      result: ctx.kernel.publishGlobalTerminalComposedSurface({
        ...input,
        ...resolveTerminalCallerScope(ctx.auth),
      }),
    })),
    activityPage: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          before: reverseTimeCursorSchema.optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.pageGlobalTerminalActivity({
          terminalId: input.terminalId,
          before: input.before,
          limit: input.limit ?? 20,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    read: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          mode: z.enum(["auto", "diff", "snapshot"]).optional(),
          remark: z.boolean().optional(),
          recordActivity: z.boolean().optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.readGlobalTerminal({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    write: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          text: z.string(),
          createApprovalRequest: z.boolean().optional(),
          readMode: z.enum(["auto", "diff", "snapshot"]).optional(),
          readRecordActivity: z.boolean().optional(),
          returnRead: z
            .union([
              z.boolean(),
              z.object({
                throttleMs: z.number().int().nonnegative().optional(),
                debounceMs: z.number().int().nonnegative().optional(),
              }),
            ])
            .optional(),
        }),
      )
      .mutation(
        async ({ ctx, input }) =>
          await ctx.kernel.writeGlobalTerminal({
            ...input,
            ...resolveTerminalCallerScope(ctx.auth),
          }),
      ),
    input: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          text: z.string(),
          createApprovalRequest: z.boolean().optional(),
          readMode: z.enum(["auto", "diff", "snapshot"]).optional(),
          readRecordActivity: z.boolean().optional(),
          returnRead: z
            .union([
              z.boolean(),
              z.object({
                throttleMs: z.number().int().nonnegative().optional(),
                debounceMs: z.number().int().nonnegative().optional(),
              }),
            ])
            .optional(),
        }),
      )
      .mutation(
        async ({ ctx, input }) =>
          await ctx.kernel.inputGlobalTerminal({
            ...input,
            ...resolveTerminalCallerScope(ctx.auth),
          }),
      ),
    listGrants: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalTerminalGrants({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    issueGrant: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          role: z.enum(["admin", "writer", "guard", "readonly"]),
          participantId: terminalActorIdSchema,
          label: z.string().trim().min(1).optional(),
          accessTokenHint: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "accessTokenHint must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
          adminCandidateRank: z.number().int().nonnegative().nullable().optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        grant: ctx.kernel.issueGlobalTerminalGrant({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    revokeGrant: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          grantId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.revokeGlobalTerminalGrant({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    listApprovalRequests: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          assignedAdminId: terminalActorIdSchema.optional(),
          participantId: terminalActorIdSchema.optional(),
          statuses: z.array(z.enum(["pending", "approved", "denied", "expired"])).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalTerminalApprovalRequests({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    permissionRequests: authProcedure
      .input(
        z
          .object({
            terminalId: z.string().min(1).optional(),
            statuses: z.array(z.enum(["pending", "approved", "denied", "expired"])).optional(),
          })
          .optional(),
      )
      .subscription(({ ctx, input }) => {
        return observable<
          | { type: "snapshot"; items: ReturnType<typeof ctx.kernel.listObservableGlobalTerminalApprovalRequests> }
          | {
              type: "request";
              request: ReturnType<typeof ctx.kernel.listObservableGlobalTerminalApprovalRequests>[number];
            }
        >((emit) => {
          const terminalScope = resolveTerminalCallerScope(ctx.auth);
          const listInput = {
            terminalId: input?.terminalId,
            statuses: input?.statuses ?? ["pending"],
            ...terminalScope,
          };
          emit.next({
            type: "snapshot",
            items: ctx.kernel.listObservableGlobalTerminalApprovalRequests(listInput),
          });
          const unsubscribe = ctx.kernel.onObservableGlobalTerminalApprovalRequest(
            {
              terminalId: input?.terminalId,
              ...terminalScope,
            },
            (payload) => {
              if (input?.statuses && !input.statuses.includes(payload.request.status)) {
                return;
              }
              emit.next({
                type: "request",
                request: payload.request,
              });
            },
          );
          return unsubscribe;
        });
      }),
    approveRequest: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          requestId: z.string().min(1),
          durationMs: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.approveGlobalTerminalRequest({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    denyRequest: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          requestId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.denyGlobalTerminalRequest({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    grantWriteLease: authProcedure
      .input(
        z.object({
          terminalId: z.string().min(1),
          participantId: terminalActorIdSchema,
          durationMs: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.grantGlobalTerminalWriteLease({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    revokeWriteLease: authProcedure
      .input(
        z
          .object({
            terminalId: z.string().min(1),
            leaseId: z.string().min(1).optional(),
            participantId: terminalActorIdSchema.optional(),
          })
          .refine((value) => Boolean(value.leaseId || value.participantId), {
            message: "leaseId or participantId is required",
          }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.revokeGlobalTerminalWriteLease({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
  }),
  appRuntime: t.router({
    ensureAvatarPromptSeed: superadminProcedure
      .input(appAvatarPromptSeedInputSchema)
      .mutation(({ ctx, input }) => ctx.kernel.ensureAvatarPromptSeed(input)),
  }),
  draft: t.router({
    resolve: superadminProcedure
      .input(
        z.object({
          cwd: z.string().min(1),
          avatar: z.string().min(1).optional(),
        }),
      )
      .query(async ({ ctx, input }) => await ctx.kernel.resolveDraft(input)),
  }),
  settings: t.router({
    global: t.router({
      read: superadminProcedure.query(async ({ ctx }) => await ctx.kernel.readGlobalSettings()),
      save: superadminProcedure
        .input(
          z.object({
            content: z.string(),
            baseMtimeMs: z.number().nonnegative(),
          }),
        )
        .mutation(async ({ ctx, input }) => await ctx.kernel.saveGlobalSettings(input)),
    }),
    scope: t.router({
      list: superadminProcedure
        .input(
          z.object({
            scope: z.enum(["workspace", "global"]),
            workspacePath: z.string().min(1).optional(),
            avatar: z.string().min(1).optional(),
          }),
        )
        .query(async ({ ctx, input }) => await ctx.kernel.listSettingsScope(input)),
      read: superadminProcedure
        .input(
          z.object({
            scope: z.enum(["workspace", "global"]),
            workspacePath: z.string().min(1).optional(),
            layerId: z.string().min(1),
            avatar: z.string().min(1).optional(),
          }),
        )
        .query(async ({ ctx, input }) => await ctx.kernel.readSettingsScopeLayer(input)),
      save: superadminProcedure
        .input(
          z.object({
            scope: z.enum(["workspace", "global"]),
            workspacePath: z.string().min(1).optional(),
            layerId: z.string().min(1),
            content: z.string(),
            baseMtimeMs: z.number().nonnegative(),
            avatar: z.string().min(1).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => await ctx.kernel.saveSettingsScopeLayer(input)),
    }),
    read: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          kind: settingsKindSchema,
        }),
      )
      .query(async ({ ctx, input }) => {
        return await ctx.kernel.readSettings(input);
      }),
    save: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          kind: settingsKindSchema,
          content: z.string(),
          baseMtimeMs: z.number().nonnegative(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await ctx.kernel.saveSettings(input);
      }),
    layers: t.router({
      list: superadminProcedure
        .input(
          z.object({
            workspacePath: z.string().min(1),
          }),
        )
        .query(async ({ ctx, input }) => ctx.kernel.listSettingsLayers(input.workspacePath)),
      read: superadminProcedure
        .input(
          z.object({
            workspacePath: z.string().min(1),
            layerId: z.string().min(1),
          }),
        )
        .query(async ({ ctx, input }) => ctx.kernel.readSettingsLayer(input)),
      save: superadminProcedure
        .input(
          z.object({
            workspacePath: z.string().min(1),
            layerId: z.string().min(1),
            content: z.string(),
            baseMtimeMs: z.number().nonnegative(),
          }),
        )
        .mutation(async ({ ctx, input }) => ctx.kernel.saveSettingsLayer(input)),
    }),
  }),
  profile: t.router({
    service: superadminProcedure.query(async ({ ctx }) => await ctx.kernel.getAuthServiceDescriptor()),
    list: superadminProcedure.query(async ({ ctx }) => ({ items: await ctx.kernel.listProfiles() })),
    get: superadminProcedure
      .input(
        z.object({
          reference: z.string().trim().min(1),
        }),
      )
      .query(async ({ ctx, input }) => await ctx.kernel.getProfile(input.reference)),
    update: superadminProcedure
      .input(
        z.object({
          reference: z.string().trim().min(1),
          patch: profileMetadataPatchSchema,
        }),
      )
      .mutation(
        async ({ ctx, input }) =>
          await ctx.kernel.updateProfile({
            reference: input.reference,
            token: ctx.auth.token,
            patch: input.patch,
          }),
      ),
    auth: t.router({
      emailStart: publicProcedure
        .input(
          z.object({
            email: z.string().email(),
          }),
        )
        .mutation(async ({ ctx, input }) => await ctx.kernel.startProfileEmailChallenge(input.email)),
      emailVerify: publicProcedure
        .input(
          z.object({
            email: z.string().email(),
            code: z
              .string()
              .trim()
              .regex(/^\d{6}$/),
            token: z.string().trim().min(1).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => await ctx.kernel.verifyProfileEmailChallenge(input)),
    }),
  }),
  notification: t.router({
    snapshot: superadminProcedure.query(async ({ ctx }) => await ctx.kernel.getNotificationSnapshot()),
    setChatVisibility: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1).optional(),
          visible: z.boolean(),
          focused: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.setChatVisibility(input)),
    setTerminalVisibility: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          terminalId: z.string().min(1).optional(),
          visible: z.boolean(),
          focused: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.setTerminalVisibility(input)),
    consume: superadminProcedure
      .input(
        z
          .object({
            sessionId: z.string().min(1),
            chatId: z.string().min(1).optional(),
            terminalId: z.string().min(1).optional(),
            upToSrc: z.string().min(1).optional(),
          })
          .refine((value) => !(value.chatId && value.terminalId), {
            message: "chatId and terminalId cannot be used together",
            path: ["terminalId"],
          }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.consumeNotifications(input)),
  }),
  task: t.router({
    list: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.listTasks(input.sessionId)),
    triggerManual: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          source: z.string().min(1),
          id: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.triggerTaskManual(input.sessionId, {
          source: input.source,
          id: input.id,
        }),
      ),
    emitEvent: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          topic: z.string().min(1),
          payload: z.unknown().optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.emitTaskEvent(input.sessionId, {
          topic: input.topic,
          payload: input.payload,
          source: "api",
        }),
      ),
  }),
  runtime: t.router({
    snapshot: superadminProcedure.query(({ ctx }) => ctx.kernel.getSnapshot()),
    modelDebug: superadminProcedure
      .input(sessionIdInput)
      .query(async ({ ctx, input }) => await ctx.kernel.inspectModelDebug(input.sessionId)),
    attentionState: superadminProcedure
      .input(sessionIdInput)
      .query(async ({ ctx, input }) => await ctx.kernel.inspectAttentionState(input.sessionId)),
    attentionDeliveryState: superadminProcedure
      .input(sessionIdInput)
      .query(async ({ ctx, input }) => await ctx.kernel.inspectAttentionDeliveryState(input.sessionId)),
    attentionDeliveryTimeline: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          contextId: z.string().trim().min(1).optional(),
          commitId: z.string().trim().min(1).optional(),
          cycleId: z.number().int().positive().optional(),
          sessionModelCallId: z.number().int().positive().optional(),
          limit: z.number().int().min(1).max(500).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const { sessionId, ...query } = input;
        return await ctx.kernel.queryAttentionDeliveryTimeline(sessionId, query);
      }),
    attentionQuery: superadminProcedure
      .input(sessionIdInput.extend(appAttentionQueryInputSchema.shape))
      .query(async ({ ctx, input }) => ({
        items: await ctx.kernel.queryAttention(input.sessionId, {
          query: input.query,
          offset: input.offset,
          limit: input.limit,
        }),
      })),
    attentionCommit: superadminProcedure
      .input(sessionIdInput.extend(appAttentionCommitInputSchema.shape))
      .mutation(async ({ ctx, input }) => {
        const { sessionId, ...commit } = input;
        return {
          commit: await ctx.kernel.commitAttention(sessionId, commit),
        };
      }),
    attentionSettle: superadminProcedure
      .input(sessionIdInput.extend(appAttentionSettleInputSchema.shape))
      .mutation(async ({ ctx, input }) => {
        const { sessionId, ...settle } = input;
        return {
          commit: await ctx.kernel.settleAttention(sessionId, settle),
        };
      }),
    requestCompact: superadminProcedure
      .input(sessionIdInput)
      .mutation(({ ctx, input }) => ctx.kernel.requestRuntimeCompact(input.sessionId)),
    schedulerLogs: superadminProcedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageSchedulerLogs(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    observabilityTraces: superadminProcedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageObservabilityTraces(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    observabilityTraceLookup: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          ref: z.string().min(1),
          limit: z.number().int().min(1).max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listObservabilityTracesByRef(input.sessionId, input.ref, input.limit ?? 200),
      })),
    heartbeatPartsPage: superadminProcedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageHeartbeatParts(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    heartbeatGroupsPage: superadminProcedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageHeartbeatGroups(input.sessionId, { before: input.before, limit: input.limit ?? 5 }),
      ),
    modelCallsPage: superadminProcedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageModelCalls(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    usageAnalytics: superadminProcedure.input(usageAnalyticsInput).query(({ ctx, input }) =>
      ctx.kernel.queryUsageAnalytics(input.sessionId, {
        sinceMs: input.sinceMs,
        untilMs: input.untilMs,
        granularity: input.granularity,
        filters: input.filters,
      }),
    ),
    requestAuxPage: superadminProcedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageRequestAuxMessages(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    apiCallsPage: superadminProcedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageApiCalls(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    terminalActivityPage: superadminProcedure
      .input(
        reversePageInput.extend({
          terminalId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.pageTerminalActivity(input.sessionId, input.terminalId, {
          before: input.before,
          limit: input.limit ?? 120,
        }),
      ),
    events: superadminProcedure
      .input(
        z
          .object({
            afterEventId: z.number().int().nonnegative().optional(),
          })
          .optional(),
      )
      .subscription(({ ctx, input }) => {
        return observable<AnyRuntimeEvent>((emit) => {
          let cursor = input?.afterEventId ?? 0;
          const pushEvent = (event: AnyRuntimeEvent): void => {
            if (event.eventId <= cursor) {
              return;
            }
            cursor = event.eventId;
            emit.next(event);
          };

          const unsubscribe = ctx.kernel.onEvent(pushEvent);
          for (const event of ctx.kernel.getEventsAfter(cursor)) {
            pushEvent(event);
          }
          return unsubscribe;
        });
      }),
    apiCalls: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          afterId: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .subscription(({ ctx, input }) => {
        return observable<
          | {
              type: "apiCall";
              payload: ReturnType<typeof ctx.kernel.listApiCalls>[number];
            }
          | {
              type: "recording";
              payload: { enabled: boolean; refCount: number };
            }
        >((emit) => {
          let cursor = input.afterId ?? 0;
          let closed = false;

          const pushRows = (rows: ReturnType<typeof ctx.kernel.listApiCalls>): void => {
            for (const row of rows) {
              if (row.id <= cursor) {
                continue;
              }
              cursor = row.id;
              emit.next({ type: "apiCall", payload: row });
            }
          };

          void ctx.kernel
            .retainApiCallSubscription(input.sessionId)
            .then((state) => {
              if (closed) {
                return;
              }
              emit.next({ type: "recording", payload: state });
              pushRows(ctx.kernel.listApiCalls(input.sessionId, cursor, input.limit ?? 200));
            })
            .catch((error) => {
              emit.error(error instanceof Error ? error : new Error(String(error)));
            });

          const unsubscribe = ctx.kernel.onEvent((event) => {
            if (event.sessionId !== input.sessionId) {
              return;
            }
            if (event.type === "runtime.apiCall") {
              const payload = event.payload as { entry: ReturnType<typeof ctx.kernel.listApiCalls>[number] };
              if (payload.entry.id <= cursor) {
                return;
              }
              cursor = payload.entry.id;
              emit.next({ type: "apiCall", payload: payload.entry });
              return;
            }
            if (event.type === "runtime.apiRecording") {
              emit.next({
                type: "recording",
                payload: event.payload as { enabled: boolean; refCount: number },
              });
            }
          });

          return () => {
            closed = true;
            unsubscribe();
            ctx.kernel.releaseApiCallSubscription(input.sessionId);
          };
        });
      }),
  }),
  workspace: t.router({
    recent: superadminProcedure
      .input(
        z
          .object({
            limit: z.number().int().positive().max(128).optional(),
          })
          .optional(),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listRecentWorkspaces(input?.limit ?? 8),
      })),
    listAll: superadminProcedure.query(({ ctx }) => ({
      items: ctx.kernel.listAllWorkspaces(),
    })),
    listSessions: superadminProcedure
      .input(
        z.object({
          path: z.string().min(1),
          tab: z.enum(["all", "running", "stopped", "archive"]),
          cursor: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(200).optional(),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.listWorkspaceSessions(input)),
    avatarCatalog: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => ({
        items: await ctx.kernel.listWorkspaceAvatarCatalog(input.workspacePath),
      })),
    forkAvatar: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        avatar: await ctx.kernel.forkWorkspaceAvatar(input),
      })),
    copyAvatar: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          sourceAvatar: z.string().min(1),
          targetAvatar: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        avatar: await ctx.kernel.copyWorkspaceAvatar(input),
      })),
    welcomeSnapshot: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const terminalScope = resolveTerminalCallerScope(ctx.auth);
        return await ctx.kernel.inspectWorkspaceWelcome({
          workspacePath: input.workspacePath,
          avatar: input.avatar,
          ...resolveMessageCallerScope(ctx.auth),
          terminalActorId: terminalScope.actorId,
          superadminTerminalActorId: terminalScope.superadminActorId,
        });
      }),
    saveAvatarRoomSeat: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          accessRole: z.enum(["admin", "member", "readonly"]),
          state: z.enum(["active", "credential-invalid"]).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.saveWorkspaceAvatarRoomSeat(input)),
    saveAvatarTerminalSeat: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          terminalId: z.string().min(1),
          accessToken: z.string().min(1),
          accessRole: z.enum(["admin", "writer", "guard", "readonly"]),
          state: z.enum(["active", "credential-invalid"]).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.saveWorkspaceAvatarTerminalSeat(input)),
    searchPaths: superadminProcedure
      .input(
        z.object({
          cwd: z.string().min(1),
          query: z.string().optional(),
          limit: z.number().int().positive().max(100).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.searchWorkspacePaths(input),
      })),
    runtimeMounts: superadminProcedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listRuntimeWorkspaceMounts(input.runtimeId),
      })),
    runtimeGrants: superadminProcedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
          workspacePath: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listRuntimeWorkspaceGrants(input),
      })),
    grantRuntime: superadminProcedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
          workspacePath: z.string().min(1),
          grants: z.array(workspaceGrantInputSchema),
        }),
      )
      .mutation(({ ctx, input }) => ({
        items: ctx.kernel.grantRuntimeWorkspace(input),
      })),
    detachRuntime: superadminProcedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
          workspacePath: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.detachRuntimeWorkspace(input)),
    assetRoots: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.getRuntimeWorkspaceAssetRoots(input)),
    cliCatalog: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => await ctx.kernel.readWorkspaceCliCatalog(input)),
    workbenchTree: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          mode: z.enum(["explorer", "private"]),
          path: z.string().optional(),
          offset: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(1000).optional(),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.listWorkspaceWorkbenchTree(input)),
    workbenchPreview: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          mode: z.enum(["explorer", "private"]),
          path: z.string().min(1),
          maxBytes: z
            .number()
            .int()
            .positive()
            .max(512 * 1024)
            .optional(),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.readWorkspaceWorkbenchPreview(input)),
    createPrivateAsset: superadminProcedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          parentPath: z.string().optional(),
          name: z.string().trim().min(1),
          kind: z.enum(["file", "directory"]),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.createWorkspacePrivateAsset(input)),
    ensurePrivateTextAsset: superadminProcedure
      .input(appPrivateTextAssetEnsureInputSchema)
      .mutation(({ ctx, input }) => ctx.kernel.ensureWorkspacePrivateTextAsset(input)),
    exec: superadminProcedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          surface: z.enum(["root-workspace", "public-workspace"]).optional(),
          command: z.string().min(1),
          cwd: z.string().min(1).optional(),
          env: z.record(z.string(), z.string()).optional(),
          stdin: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.execRuntimeWorkspace(input)),
    toggleFavorite: superadminProcedure
      .input(
        z.object({
          path: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ({
        item: ctx.kernel.toggleWorkspaceFavorite(input.path),
      })),
    toggleSessionFavorite: superadminProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.toggleSessionFavorite(input.sessionId)),
    delete: superadminProcedure
      .input(
        z.object({
          path: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.removeWorkspace(input.path)),
    cleanMissing: superadminProcedure.mutation(({ ctx }) => ctx.kernel.removeMissingWorkspaces()),
  }),
  fs: t.router({
    listDirectories: superadminProcedure
      .input(
        z
          .object({
            path: z.string().min(1).optional(),
            includeHidden: z.boolean().optional(),
          })
          .optional(),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listDirectories({
          path: input?.path,
          includeHidden: input?.includeHidden,
        }),
      })),
    validateDirectory: superadminProcedure
      .input(
        z.object({
          path: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.validateDirectory(input.path)),
  }),
});

export type AppRouter = typeof appRouter;
