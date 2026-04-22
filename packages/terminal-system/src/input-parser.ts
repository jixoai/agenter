export type MixedAction =
  | { type: "text"; data: string }
  | { type: "key"; data: string; ctrl: boolean; times: number }
  | { type: "wait"; ms: number };

const SELF_CLOSING_TAG_PATTERN = /<(key|wait)\s+([^>]*?)\/>/iy;
const ATTR_PATTERN = /([a-zA-Z][a-zA-Z0-9_-]*)=(["'])(.*?)\2/g;
const RAW_OPEN_TAG = "<raw>";
const RAW_CLOSE_TAG = "</raw>";

const NAMED_KEY_MAP: Record<string, string> = {
  enter: "\r",
  linefeed: "\n",
  tab: "\t",
  escape: "\u001b",
  backspace: "\u007f",
  up: "\u001b[A",
  down: "\u001b[B",
  right: "\u001b[C",
  left: "\u001b[D",
  home: "\u001b[H",
  end: "\u001b[F",
  pageup: "\u001b[5~",
  pagedown: "\u001b[6~",
  insert: "\u001b[2~",
  delete: "\u001b[3~",
  f1: "\u001bOP",
  f2: "\u001bOQ",
  f3: "\u001bOR",
  f4: "\u001bOS",
  f5: "\u001b[15~",
  f6: "\u001b[17~",
  f7: "\u001b[18~",
  f8: "\u001b[19~",
  f9: "\u001b[20~",
  f10: "\u001b[21~",
  f11: "\u001b[23~",
  f12: "\u001b[24~",
};

const parseAttributes = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  let match: RegExpExecArray | null = ATTR_PATTERN.exec(raw);
  while (match) {
    attrs[match[1].toLowerCase()] = match[3];
    match = ATTR_PATTERN.exec(raw);
  }
  ATTR_PATTERN.lastIndex = 0;
  return attrs;
};

const parseBool = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized === "true" || normalized === "1";
};

const parseIntOr = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const repeat = (value: string, times: number): string => value.repeat(Math.max(1, times));

const toCtrlSequence = (data: string): string => {
  if (data.length !== 1) {
    return "";
  }
  const code = data.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) {
    return "";
  }
  return String.fromCharCode(code - 64);
};

export const keyToSequence = (data: string, ctrl: boolean): string => {
  if (ctrl) {
    const seq = toCtrlSequence(data);
    if (seq.length > 0) {
      return seq;
    }
  }
  const normalized = data.toLowerCase();
  if (normalized in NAMED_KEY_MAP) {
    return NAMED_KEY_MAP[normalized];
  }
  return data;
};

const decodeRawText = (value: string): string =>
  value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

const matchSelfClosingTagAt = (
  mixed: string,
  cursor: number,
): { nextCursor: number; action: MixedAction } | null => {
  SELF_CLOSING_TAG_PATTERN.lastIndex = cursor;
  const match = SELF_CLOSING_TAG_PATTERN.exec(mixed);
  if (!match) {
    SELF_CLOSING_TAG_PATTERN.lastIndex = 0;
    return null;
  }
  const nextCursor = SELF_CLOSING_TAG_PATTERN.lastIndex;
  SELF_CLOSING_TAG_PATTERN.lastIndex = 0;
  const tag = match[1].toLowerCase();
  const attrs = parseAttributes(match[2]);
  if (tag === "wait") {
    return {
      nextCursor,
      action: {
        type: "wait",
        ms: Math.max(0, parseIntOr(attrs.ms, 0)),
      },
    };
  }
  return {
    nextCursor,
    action: {
      type: "key",
      data: attrs.data ?? "",
      ctrl: parseBool(attrs.ctrl),
      times: Math.max(1, parseIntOr(attrs.times, 1)),
    },
  };
};

const isRawOpenAt = (mixed: string, cursor: number): boolean =>
  mixed.slice(cursor, cursor + RAW_OPEN_TAG.length).toLowerCase() === RAW_OPEN_TAG;

const resolveRawCloseIndex = (mixed: string, contentStart: number): number => {
  const rawContent = mixed.slice(contentStart);
  const nextOpenOffset = rawContent.toLowerCase().indexOf(RAW_OPEN_TAG);
  const closeOffset = rawContent.toLowerCase().indexOf(RAW_CLOSE_TAG);
  if (closeOffset < 0) {
    throw new Error("mixed input raw block is missing </raw>");
  }
  if (nextOpenOffset >= 0 && nextOpenOffset < closeOffset) {
    throw new Error("mixed input raw block cannot nest <raw>");
  }
  return contentStart + closeOffset;
};

const findNextRecognizedTagStart = (mixed: string, cursor: number): number => {
  for (let index = cursor; index < mixed.length; index += 1) {
    if (mixed[index] !== "<") {
      continue;
    }
    if (isRawOpenAt(mixed, index) || matchSelfClosingTagAt(mixed, index)) {
      return index;
    }
  }
  return -1;
};

export const parseMixedInput = (mixed: string): MixedAction[] => {
  const actions: MixedAction[] = [];
  let cursor = 0;

  while (cursor < mixed.length) {
    if (isRawOpenAt(mixed, cursor)) {
      const contentStart = cursor + RAW_OPEN_TAG.length;
      const closeIndex = resolveRawCloseIndex(mixed, contentStart);
      const decoded = decodeRawText(mixed.slice(contentStart, closeIndex));
      if (decoded.length > 0) {
        actions.push({ type: "text", data: decoded });
      }
      cursor = closeIndex + RAW_CLOSE_TAG.length;
      continue;
    }

    const tagMatch = matchSelfClosingTagAt(mixed, cursor);
    if (tagMatch) {
      actions.push(tagMatch.action);
      cursor = tagMatch.nextCursor;
      continue;
    }

    const nextTagStart = findNextRecognizedTagStart(mixed, cursor + 1);
    const textEnd = nextTagStart >= 0 ? nextTagStart : mixed.length;
    const text = mixed.slice(cursor, textEnd);
    if (text.length > 0) {
      actions.push({ type: "text", data: text });
    }
    cursor = textEnd;
  }

  return actions;
};

interface RunOptions {
  write: (data: string) => void;
  wait: (ms: number) => Promise<void>;
}

export const runMixedInput = async (mixed: string, options: RunOptions): Promise<void> => {
  const actions = parseMixedInput(mixed);
  for (const action of actions) {
    if (action.type === "text") {
      if (action.data.length > 0) {
        options.write(action.data);
      }
      continue;
    }
    if (action.type === "wait") {
      await options.wait(action.ms);
      continue;
    }
    const sequence = keyToSequence(action.data, action.ctrl);
    if (sequence.length === 0) {
      continue;
    }
    options.write(repeat(sequence, action.times));
  }
};
