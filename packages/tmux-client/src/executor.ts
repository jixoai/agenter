import type { TmuxCommand, TmuxExecOptions, TmuxExecResult, TmuxExecutor } from "./types";

export class TmuxCommandError extends Error {
  readonly command: TmuxCommand;
  readonly result: TmuxExecResult;

  constructor(command: TmuxCommand, result: TmuxExecResult) {
    super(result.stderr.trim() || `${command.executable} ${command.args.join(" ")} failed with ${result.exitCode}`);
    this.name = "TmuxCommandError";
    this.command = command;
    this.result = result;
  }
}

export const defaultTmuxExecutor: TmuxExecutor = {
  async exec(command, options) {
    const proc = Bun.spawn([command.executable, ...command.args], {
      env: options?.env,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return {
      stdout,
      stderr,
      exitCode,
    };
  },
  async which(executable) {
    if (executable.includes("/")) {
      return executable;
    }
    return Bun.which(executable);
  },
};

export const assertTmuxSuccess = (command: TmuxCommand, result: TmuxExecResult): void => {
  if (result.exitCode !== 0) {
    throw new TmuxCommandError(command, result);
  }
};
