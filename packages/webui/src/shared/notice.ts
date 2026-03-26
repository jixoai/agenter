const UNKNOWN_NOTICE_VALUES = new Set(["", "unknown", "unknown error", "[object object]", "undefined", "null"]);
const NETWORK_NOTICE_VALUES = new Set(["failed to fetch", "load failed", "networkerror when attempting to fetch resource."]);

const normalizeNoticeKey = (value: string): string => value.trim().toLowerCase();

const normalizeNetworkNotice = (value: string): string | null => {
  const normalized = normalizeNoticeKey(value);
  if (NETWORK_NOTICE_VALUES.has(normalized)) {
    return "WebUI cannot reach the Agenter app server. Start it with `agenter web --dev` or verify the current API endpoint.";
  }
  return null;
};

const extractProviderErrorMessage = (value: string): string | null => {
  const match = value.match(/\((\{.*\})\)\s*$/);
  if (!match?.[1]) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]) as { error?: { message?: unknown } };
    return typeof parsed.error?.message === "string" && parsed.error.message.trim().length > 0
      ? parsed.error.message.trim()
      : null;
  } catch {
    return null;
  }
};

export const normalizeUserNotice = (value: string, fallback: string): string => {
  const networkNotice = normalizeNetworkNotice(value);
  if (networkNotice) {
    return networkNotice;
  }
  const trimmed = value.trim();
  if (UNKNOWN_NOTICE_VALUES.has(normalizeNoticeKey(trimmed))) {
    return fallback;
  }
  const providerErrorMessage = extractProviderErrorMessage(trimmed);
  if (providerErrorMessage && /(response failed|status code)/i.test(trimmed)) {
    return `Provider request failed: ${providerErrorMessage}`;
  }
  return trimmed.length > 0 ? trimmed : fallback;
};

export const displayNoticeFromError = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return normalizeUserNotice(error.message, fallback);
  }
  if (typeof error === "string") {
    return normalizeUserNotice(error, fallback);
  }
  return fallback;
};

export const isLikelyErrorNotice = (value: string): boolean => {
  const normalized = normalizeNoticeKey(value);
  if (UNKNOWN_NOTICE_VALUES.has(normalized)) {
    return true;
  }
  return /(error|failed|unable|cannot|timeout|timed out|exception|missing|invalid|not found|denied|refused|offline|disconnect|conflict)/i.test(
    value,
  );
};
