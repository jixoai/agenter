export { formatSearchSyntax } from "./format";
export { parseSearchSyntax } from "./parse";
export { SearchSyntaxError, type SearchSyntaxBooleanNode, type SearchSyntaxComparisonNode, type SearchSyntaxDiagnostic, type SearchSyntaxNode, type SearchSyntaxNotNode, type SearchSyntaxTextNode } from "./types";

import { parseSearchSyntax } from "./parse";
import type { SearchSyntaxDiagnostic } from "./types";

export const diagnoseSearchSyntax = (input: string): SearchSyntaxDiagnostic[] => {
  try {
    parseSearchSyntax(input);
    return [];
  } catch (error) {
    if (error instanceof Error && "diagnostic" in error) {
      return [(error as Error & { diagnostic: SearchSyntaxDiagnostic }).diagnostic];
    }
    return [{ message: error instanceof Error ? error.message : String(error), index: 0 }];
  }
};
