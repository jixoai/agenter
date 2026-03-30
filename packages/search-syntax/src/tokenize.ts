interface Token {
  type: "word" | "string" | "(" | ")" | ":" | ">" | ">=" | "<" | "<=" | "eof";
  value: string;
  index: number;
}

const isWhitespace = (value: string): boolean => /\s/.test(value);

const isWordBoundary = (value: string): boolean =>
  value.length === 0 || isWhitespace(value) || value === "(" || value === ")" || value === ":" || value === ">" || value === "<";

const readQuoted = (input: string, start: number, quote: string): { value: string; nextIndex: number } => {
  let index = start + 1;
  let value = "";
  while (index < input.length) {
    const current = input[index]!;
    if (current === "\\") {
      const next = input[index + 1];
      if (next) {
        value += next;
        index += 2;
        continue;
      }
    }
    if (current === quote) {
      return { value, nextIndex: index + 1 };
    }
    value += current;
    index += 1;
  }
  throw new Error(`unterminated quote:${start}`);
};

const readWord = (input: string, start: number): { value: string; nextIndex: number } => {
  let index = start;
  while (index < input.length && !isWordBoundary(input[index]!)) {
    index += 1;
  }
  return { value: input.slice(start, index), nextIndex: index };
};

export const tokenizeSearchSyntax = (input: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const current = input[index]!;
    if (isWhitespace(current)) {
      index += 1;
      continue;
    }
    if (current === "(" || current === ")" || current === ":") {
      tokens.push({ type: current, value: current, index });
      index += 1;
      continue;
    }
    if (current === ">" || current === "<") {
      const next = input[index + 1];
      if (next === "=") {
        const type = `${current}=` as ">" | ">=" | "<" | "<=";
        tokens.push({ type, value: type, index });
        index += 2;
        continue;
      }
      tokens.push({ type: current, value: current, index });
      index += 1;
      continue;
    }
    if (current === "\"" || current === "'") {
      const { value, nextIndex } = readQuoted(input, index, current);
      tokens.push({ type: "string", value, index });
      index = nextIndex;
      continue;
    }
    const { value, nextIndex } = readWord(input, index);
    tokens.push({ type: "word", value, index });
    index = nextIndex;
  }

  tokens.push({ type: "eof", value: "", index: input.length });
  return tokens;
};
