import type { SearchSyntaxNode } from "./types";

const quoteIfNeeded = (value: string): string => {
  if (value.length === 0) {
    return "\"\"";
  }
  return /\s/.test(value) ? `"${value.replaceAll("\"", "\\\"")}"` : value;
};

export const formatSearchSyntax = (node: SearchSyntaxNode): string => {
  if (node.type === "text") {
    const rendered = node.quoted ? `"${node.value.replaceAll("\"", "\\\"")}"` : quoteIfNeeded(node.value);
    return node.field ? `${node.field}:${rendered}` : rendered;
  }
  if (node.type === "comparison") {
    return `${node.field}:${node.operator}${quoteIfNeeded(node.value)}`;
  }
  if (node.type === "not") {
    const inner = formatSearchSyntax(node.child);
    return node.child.type === "boolean" ? `NOT (${inner})` : `NOT ${inner}`;
  }
  const renderedChildren = node.children.map((child) => {
    const rendered = formatSearchSyntax(child);
    return child.type === "boolean" && child.operator !== node.operator ? `(${rendered})` : rendered;
  });
  return renderedChildren.join(` ${node.operator} `);
};
