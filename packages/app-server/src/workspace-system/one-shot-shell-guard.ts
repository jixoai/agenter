import { parse } from "just-bash";

const ONE_SHOT_BACKGROUND_ERROR =
  "one-shot bash cannot keep background processes alive; create or select a live terminal and run the long-lived command there";

const readLiteralWord = (parts: Array<{ type: string; value?: string }>): string =>
  parts.map((part) => ("value" in part ? part.value ?? "" : "")).join("");

const findNestedShellScriptArg = (args: string[]): string | null => {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "-c") {
      return args[index + 1] ?? null;
    }
    if (value.startsWith("-c") && value.length > 2) {
      return value.slice(2);
    }
  }
  return null;
};

const inspectScriptForBackground = (script: string): string | null => {
  try {
    const ast = parse(script);
    for (const statement of ast.statements) {
      if (statement.background) {
        return `${ONE_SHOT_BACKGROUND_ERROR}: ${(statement.sourceText || "background statement").trim()}`;
      }
      for (const pipeline of statement.pipelines) {
        for (const command of pipeline.commands) {
          if (command.type !== "SimpleCommand") {
            continue;
          }
          const commandName = readLiteralWord(command.name?.parts ?? []);
          if (commandName !== "bash" && commandName !== "sh") {
            continue;
          }
          const nestedScript = findNestedShellScriptArg(command.args.map((word) => readLiteralWord(word.parts)));
          if (!nestedScript) {
            continue;
          }
          const nestedViolation = inspectScriptForBackground(nestedScript);
          if (nestedViolation) {
            return nestedViolation;
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
};

export const getOneShotShellProcessViolation = (script: string): string | null => inspectScriptForBackground(script);
