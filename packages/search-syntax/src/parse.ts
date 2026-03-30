import { SearchSyntaxError, type SearchSyntaxBooleanNode, type SearchSyntaxNode } from "./types";
import { tokenizeSearchSyntax } from "./tokenize";

interface Token {
  type: "word" | "string" | "(" | ")" | ":" | ">" | ">=" | "<" | "<=" | "eof";
  value: string;
  index: number;
}

const BOOLEAN_OPERATORS = new Set(["AND", "OR", "NOT"]);

const isClauseStart = (token: Token): boolean => token.type === "(" || token.type === "word" || token.type === "string";

const normalizeBoolean = (value: string): "AND" | "OR" | "NOT" | null => {
  const upper = value.toUpperCase();
  return BOOLEAN_OPERATORS.has(upper) ? (upper as "AND" | "OR" | "NOT") : null;
};

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(input: string) {
    try {
      this.tokens = tokenizeSearchSyntax(input) as Token[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const [, rawIndex = "0"] = message.split(":");
      throw new SearchSyntaxError("Unterminated quoted string", Number(rawIndex));
    }
  }

  parse(): SearchSyntaxNode {
    if (this.peek().type === "eof") {
      throw new SearchSyntaxError("Query cannot be empty", 0);
    }
    const node = this.parseOr();
    if (this.peek().type !== "eof") {
      throw new SearchSyntaxError(`Unexpected token "${this.peek().value}"`, this.peek().index);
    }
    return node;
  }

  private parseOr(): SearchSyntaxNode {
    const children: SearchSyntaxNode[] = [this.parseAnd()];
    while (this.matchWord("OR")) {
      children.push(this.parseAnd());
    }
    return children.length === 1 ? children[0]! : ({ type: "boolean", operator: "OR", children } satisfies SearchSyntaxBooleanNode);
  }

  private parseAnd(): SearchSyntaxNode {
    const children: SearchSyntaxNode[] = [this.parseUnary()];
    while (true) {
      if (this.matchWord("AND")) {
        children.push(this.parseUnary());
        continue;
      }
      const next = this.peek();
      if (next.type === "eof" || next.type === ")") {
        break;
      }
      if (next.type === "word" && normalizeBoolean(next.value) === "OR") {
        break;
      }
      if (!isClauseStart(next)) {
        break;
      }
      children.push(this.parseUnary());
    }
    return children.length === 1 ? children[0]! : ({ type: "boolean", operator: "AND", children } satisfies SearchSyntaxBooleanNode);
  }

  private parseUnary(): SearchSyntaxNode {
    if (this.matchWord("NOT")) {
      return {
        type: "not",
        child: this.parseUnary(),
      };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): SearchSyntaxNode {
    if (this.match("(")) {
      const node = this.parseOr();
      this.expect(")");
      return node;
    }
    return this.parseClause();
  }

  private parseClause(): SearchSyntaxNode {
    const current = this.peek();
    const next = this.peek(1);
    if (current.type === "word" && next.type === ":") {
      const field = this.consume().value;
      this.consume();
      const operator: ":" | ">" | ">=" | "<" | "<=" =
        this.match(">=") ?? this.match("<=") ?? this.match(">") ?? this.match("<") ?? ":";
      const value = this.readValue(true);
      if (operator !== ":" && value.length === 0) {
        throw new SearchSyntaxError(`Missing comparison value for "${field}"`, current.index);
      }
      if (operator === ":" && value.length === 0) {
        throw new SearchSyntaxError(`Missing value for "${field}"`, current.index);
      }
      if (operator === ":") {
        return {
          type: "text",
          field,
          value,
          quoted: this.previousWasString,
        };
      }
      return {
        type: "comparison",
        field,
        operator,
        value,
      };
    }
    const value = this.readValue(false);
    if (value.length === 0) {
      throw new SearchSyntaxError(`Unexpected token "${current.value}"`, current.index);
    }
    return {
      type: "text",
      value,
      quoted: this.previousWasString,
    };
  }

  private previousWasString = false;

  private readValue(allowColonChain: boolean): string {
    const token = this.peek();
    this.previousWasString = token.type === "string";
    if (token.type !== "word" && token.type !== "string") {
      return "";
    }
    let value = this.consume().value;
    if (!allowColonChain || this.previousWasString) {
      return value;
    }
    while (this.peek().type === ":" && this.peek(1).type === "word" && normalizeBoolean(this.peek(1).value) === null) {
      this.consume();
      value += `:${this.consume().value}`;
    }
    return value;
  }

  private match<TType extends Token["type"]>(type: TType): TType | null {
    if (this.peek().type !== type) {
      return null;
    }
    this.index += 1;
    return type;
  }

  private matchWord(operator: "AND" | "OR" | "NOT"): boolean {
    const token = this.peek();
    if (token.type !== "word" || normalizeBoolean(token.value) !== operator) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private expect(type: Token["type"]): void {
    if (!this.match(type)) {
      throw new SearchSyntaxError(`Expected "${type}"`, this.peek().index);
    }
  }

  private consume(): Token {
    const token = this.tokens[this.index]!;
    this.index += 1;
    return token;
  }

  private peek(offset = 0): Token {
    return this.tokens[this.index + offset]!;
  }
}

export const parseSearchSyntax = (input: string): SearchSyntaxNode => new Parser(input.trim()).parse();
