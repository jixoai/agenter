import type { TerminalObservedIdentity } from "./terminal-runtime-truth";

const OSC_PREFIX = "\u001b]";
const OSC_TERMINATOR_BEL = "\u0007";
const OSC_TERMINATOR_ST = "\u001b\\";

const normalizeObservedTitle = (value: string): string | undefined => {
  const title = value.trim();
  return title.length > 0 ? title : undefined;
};

const parseOsc7Path = (value: string): string | undefined => {
  try {
    if (!value.startsWith("file://")) {
      return undefined;
    }
    const parsed = new URL(value);
    const path = decodeURIComponent(parsed.pathname);
    return path.trim().length > 0 ? path : undefined;
  } catch {
    return undefined;
  }
};

export class TerminalObservedIdentityTracker {
  private carry = "";
  private identity: TerminalObservedIdentity = {};

  consume(text: string): TerminalObservedIdentity | null {
    if (text.length === 0) {
      return null;
    }
    const source = this.carry + text;
    let nextCarry = "";
    let searchFrom = 0;
    let changed = false;

    while (searchFrom < source.length) {
      const start = source.indexOf(OSC_PREFIX, searchFrom);
      if (start === -1) {
        nextCarry = source.endsWith("\u001b") ? "\u001b" : "";
        break;
      }

      const payloadStart = start + OSC_PREFIX.length;
      const belIndex = source.indexOf(OSC_TERMINATOR_BEL, payloadStart);
      const stIndex = source.indexOf(OSC_TERMINATOR_ST, payloadStart);
      let end = -1;
      let terminatorLength = 0;

      if (belIndex !== -1 && (stIndex === -1 || belIndex < stIndex)) {
        end = belIndex;
        terminatorLength = OSC_TERMINATOR_BEL.length;
      } else if (stIndex !== -1) {
        end = stIndex;
        terminatorLength = OSC_TERMINATOR_ST.length;
      }

      if (end === -1) {
        nextCarry = source.slice(start);
        break;
      }

      const payload = source.slice(payloadStart, end);
      changed = this.applyOscPayload(payload) || changed;
      searchFrom = end + terminatorLength;
    }

    this.carry = nextCarry;
    return changed ? { ...this.identity } : null;
  }

  applyTitle(title: string): TerminalObservedIdentity | null {
    const nextTitle = normalizeObservedTitle(title);
    if (nextTitle === this.identity.currentTitle) {
      return null;
    }
    this.identity = {
      ...this.identity,
      currentTitle: nextTitle,
    };
    return { ...this.identity };
  }

  clear(): TerminalObservedIdentity | null {
    if (!this.identity.currentPath && !this.identity.currentTitle && this.carry.length === 0) {
      return null;
    }
    this.identity = {};
    this.carry = "";
    return {};
  }

  snapshot(): TerminalObservedIdentity {
    return { ...this.identity };
  }

  private applyOscPayload(payload: string): boolean {
    const separator = payload.indexOf(";");
    if (separator === -1) {
      return false;
    }
    const code = payload.slice(0, separator);
    const body = payload.slice(separator + 1);

    if (code === "0" || code === "2") {
      return this.applyTitle(body) !== null;
    }

    if (code !== "7") {
      return false;
    }

    const nextPath = parseOsc7Path(body);
    if (nextPath === this.identity.currentPath) {
      return false;
    }
    this.identity = {
      ...this.identity,
      currentPath: nextPath,
    };
    return true;
  }
}
