export interface SearchSyntaxDiagnostic {
  message: string;
  index: number;
}

export interface SearchSyntaxTextNode {
  type: "text";
  field?: string;
  value: string;
  quoted: boolean;
}

export interface SearchSyntaxComparisonNode {
  type: "comparison";
  field: string;
  operator: ":" | ">" | ">=" | "<" | "<=";
  value: string;
}

export interface SearchSyntaxBooleanNode {
  type: "boolean";
  operator: "AND" | "OR";
  children: SearchSyntaxNode[];
}

export interface SearchSyntaxNotNode {
  type: "not";
  child: SearchSyntaxNode;
}

export type SearchSyntaxNode =
  | SearchSyntaxTextNode
  | SearchSyntaxComparisonNode
  | SearchSyntaxBooleanNode
  | SearchSyntaxNotNode;

export class SearchSyntaxError extends Error {
  readonly diagnostic: SearchSyntaxDiagnostic;

  constructor(message: string, index: number) {
    super(message);
    this.name = "SearchSyntaxError";
    this.diagnostic = { message, index };
  }
}
