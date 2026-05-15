import { execFile } from "node:child_process";

import type { SecureFetch } from "just-bash";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BUFFER_BYTES = 12 * 1024 * 1024;

type RootFetchOptions = Parameters<SecureFetch>[1];
type RootFetchResult = Awaited<ReturnType<SecureFetch>>;

interface RootFetchPayload {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  followRedirects: boolean;
  timeoutMs: number;
}

interface RootFetchWorkerResult {
  ok: boolean;
  result?: RootFetchResult;
  error?: string;
}

const ROOT_FETCH_WORKER_SOURCE = String.raw`
const payload = JSON.parse(process.argv[1] ?? "{}");
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort("aborted"), payload.timeoutMs);

try {
  const response = await fetch(payload.url, {
    method: payload.method,
    headers: payload.headers,
    body: payload.body,
    redirect: payload.followRedirects ? "follow" : "manual",
    signal: controller.signal,
  });
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const result = {
    status: response.status,
    statusText: response.statusText,
    headers,
    body: await response.text(),
    url: response.url,
  };
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch (error) {
  const causeMessage =
    error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object" && "message" in error.cause
      ? String(error.cause.message)
      : "";
  const message =
    causeMessage.length > 0
      ? causeMessage
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error);
  process.stdout.write(JSON.stringify({ ok: false, error: message }));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
`;

const normalizeRequestHeaders = (headers?: Headers | Record<string, string>): Record<string, string> => {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    const normalized: Record<string, string> = {};
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }
  return { ...headers };
};

const formatTransportError = (url: string, message: string): Error => new Error(`transport failure for ${url}: ${message}`);

const execNodeFetch = async (payload: RootFetchPayload): Promise<RootFetchWorkerResult> =>
  await new Promise((resolve, reject) => {
    execFile(
      "node",
      ["--input-type=module", "-e", ROOT_FETCH_WORKER_SOURCE, JSON.stringify(payload)],
      {
        maxBuffer: MAX_BUFFER_BYTES,
      },
      (error, stdout, stderr) => {
        const output = stdout.trim().length > 0 ? stdout.trim() : stderr.trim();
        if (!output) {
          if (error) {
            reject(formatTransportError(payload.url, error.message));
            return;
          }
          reject(formatTransportError(payload.url, "empty node fetch result"));
          return;
        }
        try {
          resolve(JSON.parse(output) as RootFetchWorkerResult);
        } catch (parseError) {
          const detail = parseError instanceof Error ? parseError.message : String(parseError);
          reject(formatTransportError(payload.url, `unparseable node fetch result: ${detail}`));
        }
      },
    );
  });

export const createTruthfulRootWorkspaceFetch = (): SecureFetch => {
  return async (inputUrl, options = {}) => {
    const payload: RootFetchPayload = {
      url: inputUrl,
      method: options.method ?? "GET",
      headers: normalizeRequestHeaders(options.headers),
      body: options.body,
      followRedirects: options.followRedirects !== false,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
    const workerResult = await execNodeFetch(payload);
    if (!workerResult.ok || !workerResult.result) {
      throw formatTransportError(inputUrl, workerResult.error ?? "node fetch failed");
    }
    return workerResult.result;
  };
};
