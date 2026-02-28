const OPTIONS_WITH_VALUE = new Set(["-o", "--output-dir", "--size", "--color", "--log-style"]);
const BOOLEAN_OPTIONS = new Set(["--debug-cursor", "--keep-style", "--no-keep-style"]);

const findFirstPositionalIndex = (argv: string[]): number => {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--") {
      return index + 1 < argv.length ? index + 1 : -1;
    }
    if (token.length === 0) {
      continue;
    }
    if (token.startsWith("--output-dir=")) {
      continue;
    }
    if (token.startsWith("--size=")) {
      continue;
    }
    if (token.startsWith("--color=")) {
      continue;
    }
    if (token.startsWith("--log-style=")) {
      continue;
    }
    if (BOOLEAN_OPTIONS.has(token)) {
      continue;
    }
    if (OPTIONS_WITH_VALUE.has(token)) {
      index += 1;
      continue;
    }
    if (!token.startsWith("-")) {
      return index;
    }
  }
  return -1;
};

/**
 * Normalize CLI args to `run` command semantics:
 * - `ati run codex` => unchanged
 * - `ati codex` => `ati run codex`
 */
export const normalizeAtiArgv = (argv: string[]): string[] => {
  const next = [...argv];
  const positionalIndex = findFirstPositionalIndex(next);
  if (positionalIndex < 0) {
    return next;
  }
  if (next[positionalIndex] === "run") {
    return next;
  }
  next.splice(positionalIndex, 0, "run");
  return next;
};

const shouldTreatAsAtiOption = (token: string): boolean => {
  if (OPTIONS_WITH_VALUE.has(token) || BOOLEAN_OPTIONS.has(token)) {
    return true;
  }
  if (token.startsWith("--output-dir=")) {
    return true;
  }
  if (token.startsWith("--size=")) {
    return true;
  }
  if (token.startsWith("--color=")) {
    return true;
  }
  if (token.startsWith("--log-style=")) {
    return true;
  }
  return token.startsWith("-");
};

/**
 * Enforce `run [options] [args]` layout:
 * - Only parse ATI options before the first non-option arg after `run`.
 * - Remaining args are passed through to child process verbatim.
 */
export const normalizeAtiRunLayout = (argv: string[]): string[] => {
  const normalized = normalizeAtiArgv(argv);
  const commandIndex = findFirstPositionalIndex(normalized);
  if (commandIndex < 0 || normalized[commandIndex] !== "run") {
    return normalized;
  }

  const beforeRun = normalized.slice(0, commandIndex);
  const afterRun = normalized.slice(commandIndex + 1);
  const runOptions: string[] = [];

  let index = 0;
  while (index < afterRun.length) {
    const token = afterRun[index] ?? "";
    if (token === "--") {
      index += 1;
      break;
    }
    if (!shouldTreatAsAtiOption(token)) {
      break;
    }
    runOptions.push(token);
    if (OPTIONS_WITH_VALUE.has(token) && !token.includes("=") && index + 1 < afterRun.length) {
      index += 1;
      runOptions.push(afterRun[index] ?? "");
    }
    index += 1;
  }

  const childArgs = afterRun.slice(index);
  if (childArgs.length === 0) {
    return [...beforeRun, "run", ...runOptions];
  }
  const [program, ...rest] = childArgs;
  return [...beforeRun, "run", ...runOptions, program, ...(rest.length > 0 ? ["--", ...rest] : [])];
};
