import { clear, get, set } from "idb-keyval";

const HELP_HINT_NAMESPACE = "agenter:webui:help:dismissed:v1";

const dismissedCache = new Map<string, boolean>();
const keyCache = new Map<string, string>();

interface HelpHintKeyInput {
  textContext: string;
  helpId?: string;
}

const toHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let output = "";
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, "0");
  }
  return output;
};

const fallbackHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${hash >>> 0}`.padStart(10, "0");
};

const sha256 = async (value: string): Promise<string> => {
  if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.subtle === "undefined") {
    return fallbackHash(value);
  }
  try {
    const encoder = new TextEncoder();
    const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(value));
    return toHex(digest);
  } catch {
    return fallbackHash(value);
  }
};

const normalize = (value: string): string => value.trim().replaceAll(/\s+/g, " ");

const keySeed = (input: HelpHintKeyInput): string => {
  const context = normalize(input.textContext);
  return input.helpId ? `${input.helpId}\n${context}` : context;
};

export const resolveHelpHintDismissedKey = async (input: HelpHintKeyInput): Promise<string> => {
  const seed = keySeed(input);
  const cached = keyCache.get(seed);
  if (cached) {
    return cached;
  }
  const digest = await sha256(seed);
  const key = `${HELP_HINT_NAMESPACE}:${digest}`;
  keyCache.set(seed, key);
  return key;
};

export const readHelpHintDismissed = async (input: HelpHintKeyInput): Promise<boolean> => {
  const key = await resolveHelpHintDismissedKey(input);
  const cached = dismissedCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const value = await get<boolean>(key);
    const dismissed = value === true;
    dismissedCache.set(key, dismissed);
    return dismissed;
  } catch {
    return false;
  }
};

export const dismissHelpHint = async (input: HelpHintKeyInput): Promise<void> => {
  const key = await resolveHelpHintDismissedKey(input);
  dismissedCache.set(key, true);
  try {
    await set(key, true);
  } catch {
    // Ignore persistence failures; hover/click interaction still works in-memory.
  }
};

export const __resetHelpHintDismissedCacheForTests = () => {
  dismissedCache.clear();
  keyCache.clear();
};

export const __clearHelpHintPersistenceForTests = async (): Promise<void> => {
  __resetHelpHintDismissedCacheForTests();
  try {
    await clear();
  } catch {
    // Ignore IndexedDB clear failures in tests.
  }
};
