import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import yargs from "yargs";

const DEFAULT_ENDPOINT = "http://127.0.0.1:4591";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const jsonHeaders = {
  "content-type": "application/json",
};

const readCliOption = (argv: string[], optionName: string): string | null => {
  const index = argv.indexOf(optionName);
  if (index < 0) {
    return null;
  }
  const value = argv[index + 1];
  return value && !value.startsWith("-") ? value : null;
};

const printJson = (value: unknown): void => {
  console.log(JSON.stringify(value, null, 2));
};

const resolveToken = (args: { token?: string | null }, argvToken: string | null): string => {
  const token =
    args.token?.trim() ??
    argvToken?.trim() ??
    process.env.AUTH_SERVICE_TOKEN?.trim() ??
    process.env.PROFILE_SERVICE_TOKEN?.trim() ??
    "";
  if (token.length === 0) {
    throw new Error("token is required; pass --token or set AUTH_SERVICE_TOKEN");
  }
  return token;
};

const withAuthHeaders = (
  args: { token?: string | null },
  argvToken: string | null,
  headers: HeadersInit = {},
): HeadersInit => ({
  ...headers,
  authorization: `Bearer ${resolveToken(args, argvToken)}`,
});

const readJsonResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      body.length > 0 ? `request failed (${response.status}): ${body}` : `request failed (${response.status})`,
    );
  }
  return (await response.json()) as T;
};

const readIconFile = async (filePath: string): Promise<{ bytes: Uint8Array; mimeType: string }> => {
  const bytes = new Uint8Array(await readFile(filePath));
  const extension = extname(filePath).toLowerCase();
  const mimeType = IMAGE_MIME_BY_EXT[extension];
  if (!mimeType) {
    throw new Error(`unsupported icon file extension: ${extension || "<none>"}`);
  }
  return { bytes, mimeType };
};

const parseExtraJson = (value: string | undefined): Record<string, unknown> | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("--extra-json must be a JSON object");
  }
  return parsed as Record<string, unknown>;
};

const toOwnedArrayBuffer = (bytes: Uint8Array): ArrayBuffer => new Uint8Array(bytes).buffer;

export const runAuthCli = async (argvInput = process.argv): Promise<void> => {
  const rawArgs = argvInput.slice(2);
  const argvToken = readCliOption(rawArgs, "--token");

  await yargs(rawArgs)
    .scriptName("auth-cli")
    .option("endpoint", {
      type: "string",
      default: DEFAULT_ENDPOINT,
      describe: "auth-service endpoint",
    })
    .option("token", {
      type: "string",
      describe: "auth-service bearer token",
    })
    .command(
      "doctor",
      "check auth-service connectivity",
      (builder) => builder,
      async (args) => {
        const response = await fetch(`${String(args.endpoint)}/health`);
        if (!response.ok) {
          throw new Error(`auth-service health failed (${response.status})`);
        }
        console.log(`auth-service healthy at ${String(args.endpoint)}`);
      },
    )
    .command(
      "profile-get <reference>",
      "read a profile projection",
      (builder) =>
        builder.positional("reference", {
          type: "string",
          demandOption: true,
        }),
      async (args) => {
        const response = await fetch(`${String(args.endpoint)}/profiles/${encodeURIComponent(String(args.reference))}`);
        printJson(await readJsonResponse(response));
      },
    )
    .command(
      "profile-list",
      "list durable profiles",
      (builder) => builder,
      async (args) => {
        const response = await fetch(`${String(args.endpoint)}/profiles`);
        printJson(await readJsonResponse(response));
      },
    )
    .command(
      "profile-update <reference>",
      "update canonical profile metadata",
      (builder) =>
        builder
          .positional("reference", {
            type: "string",
            demandOption: true,
          })
          .option("token", { type: "string" })
          .option("nickname", { type: "string" })
          .option("display-name", { type: "string" })
          .option("phone", { type: "string" })
          .option("address", { type: "string" })
          .option("extra-json", { type: "string" }),
      async (args) => {
        const payload = {
          nickname: args.nickname,
          displayName: args.displayName,
          phone: args.phone,
          address: args.address,
          extra: parseExtraJson(args.extraJson),
        };
        const response = await fetch(
          `${String(args.endpoint)}/profiles/${encodeURIComponent(String(args.reference))}`,
          {
            method: "PATCH",
            headers: withAuthHeaders(args, argvToken, jsonHeaders),
            body: JSON.stringify(payload),
          },
        );
        printJson(await readJsonResponse(response));
      },
    )
    .command(
      "icon-profile-put <reference> <file>",
      "upload a canonical profile icon",
      (builder) =>
        builder
          .positional("reference", {
            type: "string",
            demandOption: true,
          })
          .positional("file", {
            type: "string",
            demandOption: true,
          })
          .option("token", { type: "string" }),
      async (args) => {
        const icon = await readIconFile(String(args.file));
        const response = await fetch(
          `${String(args.endpoint)}/profiles/${encodeURIComponent(String(args.reference))}/icon`,
          {
            method: "POST",
            headers: withAuthHeaders(args, argvToken, { "content-type": icon.mimeType }),
            body: new Blob([toOwnedArrayBuffer(icon.bytes)], { type: icon.mimeType }),
          },
        );
        printJson(await readJsonResponse(response));
      },
    )
    .command(
      "icon-session-put <sessionId> <file>",
      "upload a session icon",
      (builder) =>
        builder
          .positional("sessionId", {
            type: "string",
            demandOption: true,
          })
          .positional("file", {
            type: "string",
            demandOption: true,
          }),
      async (args) => {
        const icon = await readIconFile(String(args.file));
        const response = await fetch(
          `${String(args.endpoint)}/sessions/${encodeURIComponent(String(args.sessionId))}/icon`,
          {
            method: "POST",
            headers: { "content-type": icon.mimeType },
            body: new Blob([toOwnedArrayBuffer(icon.bytes)], { type: icon.mimeType }),
          },
        );
        printJson(await readJsonResponse(response));
      },
    )
    .command(
      "auth-email-start <email>",
      "start email OTP auth",
      (builder) =>
        builder.positional("email", {
          type: "string",
          demandOption: true,
        }),
      async (args) => {
        const response = await fetch(`${String(args.endpoint)}/auth/email/start`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ email: String(args.email) }),
        });
        printJson(await readJsonResponse(response));
      },
    )
    .command(
      "auth-email-verify <email> <code>",
      "verify email OTP and mint or link a profile token",
      (builder) =>
        builder
          .positional("email", {
            type: "string",
            demandOption: true,
          })
          .positional("code", {
            type: "string",
            demandOption: true,
          })
          .option("token", { type: "string" }),
      async (args) => {
        const headers = args.token || argvToken ? withAuthHeaders(args, argvToken, jsonHeaders) : jsonHeaders;
        const response = await fetch(`${String(args.endpoint)}/auth/email/verify`, {
          method: "POST",
          headers,
          body: JSON.stringify({ email: String(args.email), code: String(args.code) }),
        });
        printJson(await readJsonResponse(response));
      },
    )
    .command(
      "auth-wallet-start <identifier>",
      "start wallet challenge auth",
      (builder) =>
        builder.positional("identifier", {
          type: "string",
          demandOption: true,
        }),
      async (args) => {
        const response = await fetch(`${String(args.endpoint)}/auth/wallet/start`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ identifier: String(args.identifier) }),
        });
        printJson(await readJsonResponse(response));
      },
    )
    .command(
      "auth-wallet-verify <challengeId> <signature>",
      "verify a wallet signature and mint or link a profile token",
      (builder) =>
        builder
          .positional("challengeId", {
            type: "string",
            demandOption: true,
          })
          .positional("signature", {
            type: "string",
            demandOption: true,
          })
          .option("token", { type: "string" }),
      async (args) => {
        const headers = args.token || argvToken ? withAuthHeaders(args, argvToken, jsonHeaders) : jsonHeaders;
        const response = await fetch(`${String(args.endpoint)}/auth/wallet/verify`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            challengeId: String(args.challengeId),
            signature: String(args.signature),
          }),
        });
        printJson(await readJsonResponse(response));
      },
    )
    .demandCommand(1)
    .strict()
    .help()
    .parseAsync();
};

export const runProfileCli = runAuthCli;
