export type RuntimeToolRunner = "bash" | "sh" | "python3" | "js-exec";

const shellQuote = (value: string): string => {
  if (value.length === 0) {
    return "''";
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

export const buildRuntimeToolExecCommand = (input: {
  runner: RuntimeToolRunner;
  filePath: string;
  args: readonly string[];
}): string => {
  const command = [input.runner, shellQuote(input.filePath)];
  if (input.runner === "js-exec" && input.args.length > 0) {
    command.push("--");
  }
  command.push(...input.args.map(shellQuote));
  return command.join(" ");
};
