export type HeartbeatToolVisualHint =
  | {
      kind: "shell-sleep";
      startedAt: number;
      durationMs: number;
    }
  | {
      kind: "shell-timeout";
      startedAt: number;
      durationMs: number;
    };

type HeartbeatToolVisualHintInput = {
  tool: string;
  input: unknown;
  startedAt: number;
};

const shellDurationUnitMs = {
  "": 1_000,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

const maxTimingProgressDurationMs = shellDurationUnitMs.d;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readShellDurationMs = (rawDuration: string | undefined, rawUnit: string | undefined): number | null => {
  const duration = Number.parseFloat(rawDuration ?? "");
  const unit = (rawUnit ?? "").toLowerCase() as keyof typeof shellDurationUnitMs;
  const durationMs = duration * shellDurationUnitMs[unit];
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > maxTimingProgressDurationMs) {
    return null;
  }
  return durationMs;
};

const parseShellSleepDurationMs = (command: string): number | null => {
  const match = /^\s*sleep[\t ]+((?:\d+(?:\.\d+)?)|(?:\.\d+))([smhdSMHD]?)(?=\s*(?:$|[;&|]))/u.exec(command);
  return readShellDurationMs(match?.[1], match?.[2]);
};

const timeoutOptionPattern =
  /(?:[\t ]+(?:--foreground|--preserve-status|-v|--kill-after(?:=[^\s]+|[\t ]+[^\s]+)|-k[\t ]+[^\s]+|--signal(?:=[^\s]+|[\t ]+[^\s]+)|-s[\t ]+[^\s]+))*/u;

const parseShellTimeoutDurationMs = (command: string): number | null => {
  const match = new RegExp(
    `^\\s*timeout${timeoutOptionPattern.source}[\\t ]+((?:\\d+(?:\\.\\d+)?)|(?:\\.\\d+))([smhdSMHD]?)(?=\\s+\\S)`,
    "u",
  ).exec(command);
  return readShellDurationMs(match?.[1], match?.[2]);
};

const readShellCommandFromToolInput = (input: unknown): string | null => {
  if (typeof input === "string") {
    return input;
  }
  const record = asRecord(input);
  if (!record) {
    return null;
  }
  return typeof record.command === "string" ? record.command : typeof record.cmd === "string" ? record.cmd : null;
};

const buildTimingVisualHint = (
  input: HeartbeatToolVisualHintInput,
  kind: HeartbeatToolVisualHint["kind"],
  durationMs: number | null,
): HeartbeatToolVisualHint | null => {
  if (durationMs === null) {
    return null;
  }
  return {
    kind,
    startedAt: input.startedAt,
    durationMs,
  };
};

const getShellSleepVisualHint = (input: HeartbeatToolVisualHintInput): HeartbeatToolVisualHint | null => {
  const command = readShellCommandFromToolInput(input.input);
  if (!command) {
    return null;
  }
  return buildTimingVisualHint(input, "shell-sleep", parseShellSleepDurationMs(command));
};

const getShellTimeoutVisualHint = (input: HeartbeatToolVisualHintInput): HeartbeatToolVisualHint | null => {
  const command = readShellCommandFromToolInput(input.input);
  if (!command) {
    return null;
  }
  return buildTimingVisualHint(input, "shell-timeout", parseShellTimeoutDurationMs(command));
};

const toolVisualHintProjectors = [getShellSleepVisualHint, getShellTimeoutVisualHint] as const;

export const getHeartbeatToolVisualHint = (input: HeartbeatToolVisualHintInput): HeartbeatToolVisualHint | null => {
  for (const project of toolVisualHintProjectors) {
    const hint = project(input);
    if (hint) {
      return hint;
    }
  }
  return null;
};
