import { toJSONSchema, z, type ZodTypeAny } from "zod";

export type NoteCliInputMode = "object" | "compact";

export interface NoteCliExample {
  kind: "none" | "argv" | "stdin";
  payload?: unknown;
  description?: string;
}

export interface NoteCliDescriptor<TInput extends ZodTypeAny = ZodTypeAny> {
  namespace: "note";
  name: string;
  description: string;
  inputSchema: TInput;
  examples: readonly NoteCliExample[];
  helpNotes?: readonly string[];
  compactFields?: readonly string[];
}

const parseJsonText = (value: string, commandLabel: string, inputMode: NoteCliInputMode): unknown => {
  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return inputMode === "compact" ? [] : {};
  }
  try {
    return JSON.parse(normalizedValue) as unknown;
  } catch (error) {
    throw new Error(
      `${commandLabel} received invalid JSON: ${error instanceof Error ? error.message : String(error)}. Use \`${commandLabel} --help\` for details.`,
    );
  }
};

const decodeCompactPayload = (descriptor: NoteCliDescriptor, parsed: unknown): unknown => {
  if (!Array.isArray(parsed)) {
    throw new Error(`note ${descriptor.name} compact input must be a JSON array`);
  }
  const fields = descriptor.compactFields ?? [];
  const output: Record<string, unknown> = {};
  for (const [index, field] of fields.entries()) {
    const value = parsed[index];
    if (value !== undefined && value !== null) {
      output[field] = value;
    }
  }
  return output;
};

export const parseNoteCliInput = <TInput extends ZodTypeAny>(
  descriptor: NoteCliDescriptor<TInput>,
  args: readonly string[],
  stdin: string,
  inputMode: NoteCliInputMode = "object",
): z.output<TInput> => {
  const commandLabel = `${descriptor.namespace} ${descriptor.name}`;
  const trimmedStdin = stdin.trim();
  const payloadLabel = inputMode === "compact" ? "compact JSON array" : "JSON object payload";
  if (args.length > 1) {
    throw new Error(
      `${commandLabel} requires exactly one ${payloadLabel} source: either one argv JSON or JSON stdin. Use \`${commandLabel} --help\` for details.`,
    );
  }
  if (args.length === 1 && trimmedStdin.length > 0) {
    throw new Error(
      `${commandLabel} received both argv JSON and stdin JSON. Provide exactly one ${payloadLabel} source. Use \`${commandLabel} --help\` for details.`,
    );
  }
  const parsed =
    args.length === 1
      ? parseJsonText(args[0]!, commandLabel, inputMode)
      : trimmedStdin.length > 0
        ? parseJsonText(trimmedStdin, commandLabel, inputMode)
        : inputMode === "compact"
          ? []
          : {};
  return descriptor.inputSchema.parse(inputMode === "compact" ? decodeCompactPayload(descriptor, parsed) : parsed);
};

const renderExampleCommand = (descriptor: NoteCliDescriptor, example: NoteCliExample): string[] => {
  const commandLabel = `${descriptor.namespace} ${descriptor.name}`;
  if (example.kind === "none") {
    return [`- \`${commandLabel}\`${example.description ? ` ${example.description}` : ""}`];
  }
  if (example.kind === "argv") {
    return [
      `- Single argv JSON fallback for trivial payloads: \`${commandLabel} '${JSON.stringify(example.payload)}'\`${example.description ? ` ${example.description}` : ""}`,
    ];
  }
  const payloadLines = JSON.stringify(example.payload ?? {}, null, 2)
    .split("\n")
    .map((line) => `    ${line}`);
  return [
    `- Preferred default through \`root_bash\`${example.description ? ` ${example.description}` : ""}`,
    `  command: \`${commandLabel}\``,
    "  stdin:",
    ...payloadLines,
  ];
};

export const renderNoteCliHelp = (descriptor: NoteCliDescriptor): string => {
  const schema = toJSONSchema(descriptor.inputSchema, { unrepresentable: "any" });
  const lines = [
    `${descriptor.namespace} ${descriptor.name}`,
    "",
    `Description: ${descriptor.description}`,
    "",
    "Input JSON schema:",
    JSON.stringify(schema, null, 2),
    "",
    "Canonical forms:",
    ...descriptor.examples.flatMap((example) => renderExampleCommand(descriptor, example)),
    ...(descriptor.compactFields && descriptor.compactFields.length > 0
      ? [
          `- Optional positional compact mode: \`${descriptor.namespace} ${descriptor.name} --compact '[...]'\``,
          `  Field order: ${descriptor.compactFields.join(", ")}`,
        ]
      : []),
    ...(descriptor.helpNotes && descriptor.helpNotes.length > 0
      ? ["", "Operator notes:", ...descriptor.helpNotes.map((note) => `- ${note}`)]
      : []),
    "",
    "Only canonical JSON input is accepted. Default to JSON stdin; use one JSON argv payload only when it is trivially short, and use `--compact` only when you intentionally want positional encoding.",
  ];
  return `${lines.join("\n")}\n`;
};
