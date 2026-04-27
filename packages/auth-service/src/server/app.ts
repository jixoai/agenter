import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { readBearerToken } from "../auth/tokens";
import { buildAvatarIconUrl, buildRoomIconUrl, buildSessionIconUrl } from "../render/fallback-icons";
import { rasterizeSvg, type RasterImageFormat } from "../render/resvg-ffi";
import type { ProfileService } from "../service/profile-service";
import type { CreateManagedPrincipalInput, ProfileMetadata } from "../types";
import { renderWebAuthnUiPage, resolveWebAuthnUiAsset } from "./webauthn-ui";

const profileMetadataPatchSchema = z
  .object({
    nickname: z.string().trim().min(1).max(64).optional(),
    displayName: z.string().trim().min(1).max(128).optional(),
    phone: z.string().trim().min(1).max(64).optional(),
    address: z.string().trim().min(1).max(256).optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const sessionSeedSchema = z
  .object({
    workspacePath: z.string().trim().min(1),
    label: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

const emailStartSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

const emailVerifySchema = z
  .object({
    email: z.string().email(),
    code: z.string().trim().regex(/^\d{6}$/),
  })
  .strict();

const webauthnTicketSchema = z
  .object({
    ticketId: z.string().uuid(),
  })
  .strict();

const webauthnAuthenticationOptionsSchema = z
  .object({
    reference: z.string().trim().min(1),
  })
  .strict();

const webauthnRegistrationResponseSchema = z
  .object({
    ticketId: z.string().uuid(),
    response: z
      .object({
        id: z.string().trim().min(1),
        rawId: z.string().trim().min(1),
        type: z.literal("public-key"),
        clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
        authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
        response: z
          .object({
            clientDataJSON: z.string().trim().min(1),
            attestationObject: z.string().trim().min(1),
            transports: z.array(z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"])).optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .strict();

const webauthnAuthenticationResponseSchema = z
  .object({
    ticketId: z.string().uuid(),
    response: z
      .object({
        id: z.string().trim().min(1),
        rawId: z.string().trim().min(1),
        type: z.literal("public-key"),
        clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
        authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
        response: z
          .object({
            clientDataJSON: z.string().trim().min(1),
            authenticatorData: z.string().trim().min(1),
            signature: z.string().trim().min(1),
            userHandle: z.string().trim().min(1).optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .strict();

const authChallengeStartSchema = z
  .object({
    authId: z.string().trim().min(1),
  })
  .strict();

const walletStartSchema = z
  .object({
    identifier: z.string().trim().min(1),
  })
  .strict();

const authChallengeVerifySchema = z
  .object({
    challengeId: z.string().uuid(),
    signature: z.string().trim().min(1),
  })
  .strict();

const managedPrincipalCreateSchema = z
  .object({
    kind: z.enum(["user", "avatar", "room", "terminal", "system", "delegate"]),
    ownerKey: z.string().trim().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const managedPrincipalListSchema = z
  .object({
    kind: z.enum(["user", "avatar", "room", "terminal", "system", "delegate"]).optional(),
    ownerKey: z.string().trim().min(1).optional(),
  })
  .strict();

const SUPPORTED_ICON_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/svg+xml", "image/webp"]);
const SVG_ICON_MIME_TYPE = "image/svg+xml";

const jsonErrorResponse = (message: string, status: number): Response => Response.json({ error: message }, { status });

const mapErrorStatus = (error: Error): number => {
  if (
    error.message.includes("auth token") ||
    error.message.includes("virtual profiles are read-only") ||
    error.message.includes("not match target profile")
  ) {
    return 401;
  }
  if (
    error.message.includes("invalid ") ||
    error.message.includes("required") ||
    error.message.includes("already bound") ||
    error.message.includes("already exists") ||
    error.message.includes("not found")
  ) {
    return 400;
  }
  return 500;
};

const readJson = async <T>(request: Request, schema: z.ZodType<T>): Promise<T> => {
  const raw = await request.json().catch(() => {
    throw new HTTPException(400, { message: "invalid json body" });
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "invalid request body" });
  }
  return parsed.data;
};

const readIconUpload = async (request: Request): Promise<{ mimeType: string; bytes: Uint8Array }> => {
  const mimeType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!mimeType || !SUPPORTED_ICON_MIME_TYPES.has(mimeType)) {
    throw new HTTPException(415, { message: "unsupported icon content-type" });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new HTTPException(400, { message: "icon payload is empty" });
  }
  return { mimeType, bytes };
};

const toOwnedArrayBuffer = (bytes: Uint8Array): ArrayBuffer => new Uint8Array(bytes).buffer;

type IconResponsePayload = { mimeType: string; bytes?: Uint8Array; svg?: string };

const parseRequestedFormat = (value: string | null | undefined): "svg" | RasterImageFormat | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "svg") {
    return "svg";
  }
  if (normalized === "png") {
    return "png";
  }
  if (normalized === "jpeg" || normalized === "jpg") {
    return "jpeg";
  }
  throw new HTTPException(400, { message: `unsupported icon format: ${value}` });
};

const parseRequestedSize = (value: string | null | undefined): number => {
  if (!value) {
    return 96;
  }
  const size = Number.parseInt(value, 10);
  if (!Number.isFinite(size) || size < 16 || size > 1024) {
    throw new HTTPException(400, { message: "size must be an integer between 16 and 1024" });
  }
  return size;
};

const resolveIconVariant = async (
  icon: IconResponsePayload,
  input: { format: "svg" | RasterImageFormat | null; size: number; resvgLibraryPath?: string },
): Promise<IconResponsePayload> => {
  const svgSource = icon.svg ?? (icon.mimeType === SVG_ICON_MIME_TYPE ? icon.bytes : undefined);
  if (input.format === null) {
    if (!svgSource) {
      return icon;
    }
    return {
      mimeType: "image/png",
      bytes: rasterizeSvg({
        svg: svgSource,
        format: "png",
        width: input.size,
        height: input.size,
        libraryPath: input.resvgLibraryPath,
      }),
    };
  }
  if (input.format === "svg") {
    if (icon.svg) {
      return { mimeType: SVG_ICON_MIME_TYPE, svg: icon.svg };
    }
    if (icon.mimeType === SVG_ICON_MIME_TYPE && icon.bytes) {
      return { mimeType: SVG_ICON_MIME_TYPE, bytes: icon.bytes };
    }
    throw new HTTPException(400, { message: "svg output is only available for svg-backed icons" });
  }
  if (icon.mimeType === `image/${input.format}` && icon.bytes) {
    return { mimeType: icon.mimeType, bytes: icon.bytes };
  }
  if (!svgSource) {
    throw new HTTPException(400, { message: `${input.format} output is only available for svg-backed icons` });
  }
  return {
    mimeType: `image/${input.format}`,
    bytes: rasterizeSvg({
      svg: svgSource,
      format: input.format,
      width: input.size,
      height: input.size,
      libraryPath: input.resvgLibraryPath,
    }),
  };
};

const writeIconResponse = (icon: IconResponsePayload): Response => {
  const headers = new Headers({
    "cache-control": "public, max-age=300",
    "content-type": icon.mimeType,
  });
  return new Response(icon.bytes ? new Blob([toOwnedArrayBuffer(icon.bytes)], { type: icon.mimeType }) : (icon.svg ?? ""), {
    headers,
  });
};

export interface CreateProfileServiceAppOptions {
  service: ProfileService;
  publicBaseUrl: string;
  resvgLibraryPath?: string;
  webauthnUiDir?: string;
}

export type CreateAuthServiceAppOptions = CreateProfileServiceAppOptions;

export const createProfileServiceApp = ({
  service,
  publicBaseUrl,
  resvgLibraryPath,
  webauthnUiDir,
}: CreateProfileServiceAppOptions) => {
  const app = new Hono();

  app.onError((error) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }
    if (error instanceof Error) {
      return jsonErrorResponse(error.message, mapErrorStatus(error));
    }
    return jsonErrorResponse("internal server error", 500);
  });

  app.get("/health", (context) => context.json({ ok: true }));

  app.get("/auth/descriptor", (context) => context.json(service.describeAuth()));

  app.post("/auth/root-key/reveal", (context) => context.json(service.revealRootAuthPrivateKey()));

  app.get("/auth/session", async (context) => {
    const token = readBearerToken(context.req.header("authorization"));
    const session = await service.authenticateAuthToken(token);
    if (!session) {
      return jsonErrorResponse("invalid auth token", 401);
    }
    return context.json(session);
  });

  app.post("/auth/challenge", async (context) => {
    const payload = await readJson(context.req.raw, authChallengeStartSchema);
    const result = await service.createAuthChallenge(payload.authId);
    return context.json(result);
  });

  app.post("/auth/verify", async (context) => {
    const payload = await readJson(context.req.raw, authChallengeVerifySchema);
    const token = readBearerToken(context.req.header("authorization"));
    const result = await service.verifyAuthChallenge(payload.challengeId, payload.signature, token);
    return context.json(result);
  });

  app.post("/principals/managed", async (context) => {
    const payload = await readJson<CreateManagedPrincipalInput>(context.req.raw, managedPrincipalCreateSchema);
    return context.json(await service.createManagedPrincipal(payload));
  });

  app.get("/principals", async (context) => {
    const parsed = managedPrincipalListSchema.safeParse({
      kind: context.req.query("kind") ?? undefined,
      ownerKey: context.req.query("ownerKey") ?? undefined,
    });
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: parsed.error.issues[0]?.message ?? "invalid request query",
      });
    }
    return context.json({
      items: await service.listManagedPrincipals(parsed.data),
    });
  });

  app.get("/principals/:principalId", async (context) => {
    const principal = await service.resolvePrincipal(context.req.param("principalId"));
    if (!principal) {
      return jsonErrorResponse("principal not found", 404);
    }
    return context.json(principal);
  });

  app.post("/principals/:principalId/reveal", async (context) => {
    const principal = await service.revealManagedPrincipal(context.req.param("principalId"));
    if (!principal) {
      return jsonErrorResponse("principal not found", 404);
    }
    return context.json(principal);
  });

  app.get("/profiles", async (context) => {
    const profiles = await service.listProfiles();
    return context.json({ profiles });
  });

  app.get("/profiles/:reference", async (context) => {
    const profile = await service.resolveProfile(context.req.param("reference"));
    return context.json(profile);
  });

  app.patch("/profiles/:reference", async (context) => {
    const metadataPatch = await readJson<ProfileMetadata>(context.req.raw, profileMetadataPatchSchema);
    const token = readBearerToken(context.req.header("authorization"));
    const profile = await service.patchProfileMetadata(context.req.param("reference"), metadataPatch, token);
    return context.json(profile);
  });

  app.post("/profiles/:reference/icon", async (context) => {
    const token = readBearerToken(context.req.header("authorization"));
    const { mimeType, bytes } = await readIconUpload(context.req.raw);
    const profile = await service.putProfileIcon(context.req.param("reference"), mimeType, bytes, token);
    return context.json({
      ok: true,
      profileId: profile.profileId,
      iconUrl: profile.iconUrl,
    });
  });

  app.get("/media/profiles/:reference/icon", async (context) => {
    const icon = await resolveIconVariant(await service.resolveProfileIcon(context.req.param("reference")), {
      format: parseRequestedFormat(context.req.query("format")),
      size: parseRequestedSize(context.req.query("size")),
      resvgLibraryPath,
    });
    return writeIconResponse(icon);
  });

  app.post("/avatars/:principalId/icon", async (context) => {
    const principalId = context.req.param("principalId");
    const principal = await service.resolvePrincipal(principalId);
    if (!principal || principal.kind !== "avatar") {
      return jsonErrorResponse("avatar principal not found", 404);
    }
    const { mimeType, bytes } = await readIconUpload(context.req.raw);
    await service.putAvatarIcon(principal.principalId, mimeType, bytes);
    return context.json({
      ok: true,
      principalId: principal.principalId,
      iconUrl: `${publicBaseUrl}${buildAvatarIconUrl(principal.principalId)}`,
    });
  });

  app.get("/media/avatars/:principalId/icon", async (context) => {
    const icon = await service.resolveAvatarIcon(context.req.param("principalId"));
    if (!icon) {
      return jsonErrorResponse("avatar principal not found", 404);
    }
    const resolved = await resolveIconVariant(icon, {
      format: parseRequestedFormat(context.req.query("format")),
      size: parseRequestedSize(context.req.query("size")),
      resvgLibraryPath,
    });
    return writeIconResponse(resolved);
  });

  app.post("/sessions/:sessionId/icon", async (context) => {
    const sessionId = context.req.param("sessionId");
    const { mimeType, bytes } = await readIconUpload(context.req.raw);
    await service.putSessionIcon(sessionId, mimeType, bytes);
    return context.json({
      ok: true,
      sessionId,
      iconUrl: `${publicBaseUrl}${buildSessionIconUrl(sessionId)}`,
    });
  });

  app.put("/sessions/:sessionId/seed", async (context) => {
    const sessionId = context.req.param("sessionId");
    const payload = await readJson(context.req.raw, sessionSeedSchema);
    await service.upsertSessionSeed({
      sessionId,
      workspacePath: payload.workspacePath,
      label: payload.label,
    });
    return context.json({
      ok: true,
      sessionId,
      iconUrl: `${publicBaseUrl}${buildSessionIconUrl(sessionId)}`,
    });
  });

  app.get("/media/sessions/:sessionId/icon", async (context) => {
    const sessionId = context.req.param("sessionId");
    const icon = await resolveIconVariant(await service.resolveSessionIcon(sessionId), {
      format: parseRequestedFormat(context.req.query("format")),
      size: parseRequestedSize(context.req.query("size")),
      resvgLibraryPath,
    });
    return writeIconResponse(icon);
  });

  app.post("/rooms/:roomId/icon", async (context) => {
    const roomId = context.req.param("roomId");
    const { mimeType, bytes } = await readIconUpload(context.req.raw);
    await service.putRoomIcon(roomId, mimeType, bytes);
    return context.json({
      ok: true,
      roomId,
      iconUrl: `${publicBaseUrl}${buildRoomIconUrl(roomId)}`,
    });
  });

  app.get("/media/rooms/:roomId/icon", async (context) => {
    const roomId = context.req.param("roomId");
    const icon = await resolveIconVariant(await service.resolveRoomIcon(roomId), {
      format: parseRequestedFormat(context.req.query("format")),
      size: parseRequestedSize(context.req.query("size")),
      resvgLibraryPath,
    });
    return writeIconResponse(icon);
  });

  app.post("/auth/email/start", async (context) => {
    const payload = await readJson(context.req.raw, emailStartSchema);
    const result = await service.createEmailChallenge(payload.email);
    return context.json({
      challengeId: result.challengeId,
      delivery: "console",
      expiresAt: result.expiresAt,
    });
  });

  app.post("/auth/email/verify", async (context) => {
    const payload = await readJson(context.req.raw, emailVerifySchema);
    const token = readBearerToken(context.req.header("authorization"));
    const result = await service.verifyEmailChallenge(payload.email, payload.code, token);
    return context.json({
      ...result,
      registrationUrl: `${publicBaseUrl}/auth/webauthn/register?ticket=${encodeURIComponent(result.registrationTicket)}`,
    });
  });

  app.get("/auth/webauthn/register", (context) =>
    context.html(renderWebAuthnUiPage("register"), 200, {
      "cache-control": "no-store",
    }),
  );

  app.get("/auth/webauthn/authenticate", (context) =>
    context.html(renderWebAuthnUiPage("authenticate"), 200, {
      "cache-control": "no-store",
    }),
  );

  app.get("/auth/webauthn/assets/:assetName", (context) => {
    const assetName = context.req.param("assetName");
    const match = assetName.match(/^(register|authenticate)\.(js|css)$/);
    if (!match) {
      throw new HTTPException(404, { message: "webauthn asset not found" });
    }
    const asset = resolveWebAuthnUiAsset(match[1] as "register" | "authenticate", match[2] as "js" | "css", webauthnUiDir);
    if (!asset) {
      throw new HTTPException(404, { message: "webauthn asset not built" });
    }
    return new Response(asset.content, {
      headers: {
        "cache-control": "no-store",
        "content-type": asset.contentType,
      },
    });
  });

  app.post("/auth/webauthn/register/options", async (context) => {
    const payload = await readJson(context.req.raw, webauthnTicketSchema);
    const result = await service.createWebAuthnRegistrationOptions(payload.ticketId);
    return context.json(result);
  });

  app.post("/auth/webauthn/register/verify", async (context) => {
    const payload = await readJson(context.req.raw, webauthnRegistrationResponseSchema);
    const result = await service.verifyWebAuthnRegistration(payload.ticketId, payload.response);
    return context.json(result);
  });

  app.post("/auth/webauthn/authenticate/options", async (context) => {
    const payload = await readJson(context.req.raw, webauthnAuthenticationOptionsSchema);
    const result = await service.createWebAuthnAuthenticationOptions(payload.reference);
    return context.json(result);
  });

  app.post("/auth/webauthn/authenticate/verify", async (context) => {
    const payload = await readJson(context.req.raw, webauthnAuthenticationResponseSchema);
    const result = await service.verifyWebAuthnAuthentication(payload.ticketId, payload.response);
    return context.json(result);
  });

  app.post("/auth/wallet/start", async (context) => {
    const payload = await readJson(context.req.raw, walletStartSchema);
    const result = await service.createAuthChallenge(payload.identifier);
    return context.json(result);
  });

  app.post("/auth/wallet/verify", async (context) => {
    const payload = await readJson(context.req.raw, authChallengeVerifySchema);
    const token = readBearerToken(context.req.header("authorization"));
    const result = await service.verifyAuthChallenge(payload.challengeId, payload.signature, token);
    return context.json(result);
  });

  return app;
};

export const createAuthServiceApp = createProfileServiceApp;
