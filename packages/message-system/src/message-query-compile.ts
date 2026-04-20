import {
  parseSearchSyntax,
  type SearchSyntaxComparisonNode,
  type SearchSyntaxNode,
  type SearchSyntaxTextNode,
} from "@agenter/search-syntax";

type MessageQueryComparisonField = "createdAt" | "updatedAt" | "messageId";

export interface MessageQueryDocument {
  chatId: string;
  chatTitle: string;
  contextId: string | null;
  messageId: number;
  rootId: string | null;
  senderActorId: string | null;
  from: string;
  kind: string;
  content: string;
  normalizedContent: string;
  createdAt: number;
  updatedAt: number;
  visibleAt: number | null;
  recalledAt: number | null;
  hasAttachment: boolean;
  attachmentCount: number;
  searchText: string;
}

export type MessageQueryCandidateFilter =
  | { kind: "from"; value: string }
  | { kind: "chat"; value: string }
  | { kind: "context"; value: string }
  | { kind: "kind"; value: string }
  | { kind: "root"; value: string }
  | { kind: "has"; value: "attachment" | "recalled" }
  | { kind: "is"; value: "recalled" | "visible" | "hidden" }
  | {
      kind: "comparison";
      field: MessageQueryComparisonField;
      operator: SearchSyntaxComparisonNode["operator"];
      value: number;
    };

interface MessageQuerySeed {
  value: string;
  quoted: boolean;
}

export interface CompiledMessageQuery {
  ast: SearchSyntaxNode;
  candidateFilters: MessageQueryCandidateFilter[];
  ftsQuery: string | null;
  evaluate: (document: MessageQueryDocument) => boolean;
}

const normalize = (value: string): string => value.trim().toLowerCase();

const normalizeField = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  return value.trim().toLowerCase();
};

const parseDateLike = (value: string): number | undefined => {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseInteger = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}_:-]+/u)
    .filter(Boolean);

const textContains = (haystack: string, needle: string, quoted: boolean): boolean => {
  const left = haystack.toLowerCase();
  const right = needle.toLowerCase();
  if (!quoted && right.endsWith("*") && right.length > 1) {
    const prefix = right.slice(0, -1);
    return tokenize(left).some((token) => token.startsWith(prefix));
  }
  return left.includes(right);
};

const parseHasValue = (value: string): "attachment" | "recalled" | null => {
  const normalized = normalize(value);
  if (
    normalized === "attachment" ||
    normalized === "attachments" ||
    normalized === "asset" ||
    normalized === "assets"
  ) {
    return "attachment";
  }
  if (normalized === "recalled") {
    return "recalled";
  }
  return null;
};

const parseIsValue = (value: string): "recalled" | "visible" | "hidden" | null => {
  const normalized = normalize(value);
  if (normalized === "recalled" || normalized === "visible" || normalized === "hidden") {
    return normalized;
  }
  return null;
};

const readComparisonField = (field: string): MessageQueryComparisonField | null => {
  const normalized = normalize(field);
  if (normalized === "created" || normalized === "createdat" || normalized === "before" || normalized === "after") {
    return "createdAt";
  }
  if (normalized === "updated" || normalized === "updatedat") {
    return "updatedAt";
  }
  if (normalized === "message" || normalized === "messageid" || normalized === "id") {
    return "messageId";
  }
  return null;
};

const buildComparisonFilter = (
  field: MessageQueryComparisonField | null,
  operator: SearchSyntaxComparisonNode["operator"],
  value: string,
): MessageQueryCandidateFilter | null => {
  if (!field) {
    return null;
  }
  const parsed = field === "messageId" ? parseInteger(value) : parseDateLike(value);
  if (parsed === undefined) {
    return null;
  }
  return {
    kind: "comparison",
    field,
    operator,
    value: parsed,
  };
};

const extractCandidateFilter = (node: SearchSyntaxNode): MessageQueryCandidateFilter | null => {
  if (node.type === "comparison") {
    return buildComparisonFilter(readComparisonField(node.field), node.operator, node.value);
  }
  if (node.type !== "text") {
    return null;
  }
  const field = normalizeField(node.field);
  if (!field) {
    return null;
  }
  if (field === "from" || field === "author" || field === "sender") {
    return { kind: "from", value: normalize(node.value) };
  }
  if (field === "chat" || field === "chatid" || field === "room" || field === "roomid") {
    return { kind: "chat", value: normalize(node.value) };
  }
  if (field === "context" || field === "contextid") {
    return { kind: "context", value: normalize(node.value) };
  }
  if (field === "kind") {
    return { kind: "kind", value: normalize(node.value) };
  }
  if (field === "root" || field === "rootid") {
    return { kind: "root", value: normalize(node.value) };
  }
  if (field === "has") {
    const value = parseHasValue(node.value);
    return value ? { kind: "has", value } : null;
  }
  if (field === "is") {
    const value = parseIsValue(node.value);
    return value ? { kind: "is", value } : null;
  }
  if (field === "before") {
    return buildComparisonFilter("createdAt", "<", node.value);
  }
  if (field === "after" || field === "since") {
    return buildComparisonFilter("createdAt", ">=", node.value);
  }
  return null;
};

const flattenTopLevelConjunction = (node: SearchSyntaxNode): SearchSyntaxNode[] => {
  if (node.type === "boolean" && node.operator === "AND") {
    return node.children.flatMap(flattenTopLevelConjunction);
  }
  return [node];
};

const buildFtsTerm = (value: string, quoted: boolean): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!quoted && trimmed.endsWith("*") && trimmed.length > 1) {
    const prefix = trimmed.slice(0, -1).trim();
    return /^[\p{L}\p{N}_:-]+$/u.test(prefix) ? `${prefix}*` : `"${prefix.replaceAll('"', '""')}"`;
  }
  return `"${trimmed.replaceAll('"', '""')}"`;
};

const analyzeSeeds = (node: SearchSyntaxNode): MessageQuerySeed[] => {
  if (node.type === "not") {
    return [];
  }
  if (node.type === "boolean") {
    if (node.operator !== "AND") {
      return [];
    }
    return node.children.flatMap(analyzeSeeds);
  }
  if (node.type === "comparison") {
    return [];
  }
  const field = normalizeField(node.field);
  if (field === "has" || field === "is" || field === "before" || field === "after" || field === "since") {
    return [];
  }
  return [{ value: node.value, quoted: node.quoted }];
};

const evaluateComparison = (node: SearchSyntaxComparisonNode, document: MessageQueryDocument): boolean => {
  const field = readComparisonField(node.field);
  const filter = buildComparisonFilter(field, node.operator, node.value);
  if (!filter || filter.kind !== "comparison") {
    return false;
  }
  const left =
    filter.field === "createdAt"
      ? document.createdAt
      : filter.field === "updatedAt"
        ? document.updatedAt
        : document.messageId;
  if (filter.operator === ">") {
    return left > filter.value;
  }
  if (filter.operator === ">=") {
    return left >= filter.value;
  }
  if (filter.operator === "<") {
    return left < filter.value;
  }
  if (filter.operator === "<=") {
    return left <= filter.value;
  }
  return left === filter.value;
};

const evaluateText = (node: SearchSyntaxTextNode, document: MessageQueryDocument): boolean => {
  const field = normalizeField(node.field);
  if (!field || field === "text" || field === "content" || field === "message") {
    return textContains(document.normalizedContent, node.value, node.quoted);
  }
  if (field === "from" || field === "author" || field === "sender") {
    return (
      normalize(document.senderActorId ?? "") === normalize(node.value) ||
      textContains(document.from, node.value, node.quoted)
    );
  }
  if (field === "chat" || field === "chatid" || field === "room" || field === "roomid") {
    return (
      normalize(document.chatId) === normalize(node.value) || textContains(document.chatTitle, node.value, node.quoted)
    );
  }
  if (field === "context" || field === "contextid") {
    return normalize(document.contextId ?? "") === normalize(node.value);
  }
  if (field === "title") {
    return textContains(document.chatTitle, node.value, node.quoted);
  }
  if (field === "kind") {
    return normalize(document.kind) === normalize(node.value);
  }
  if (field === "root" || field === "rootid") {
    return normalize(document.rootId ?? "") === normalize(node.value);
  }
  if (field === "id" || field === "message" || field === "messageid") {
    return String(document.messageId) === node.value.trim();
  }
  if (field === "has") {
    const value = parseHasValue(node.value);
    return value === "attachment"
      ? document.hasAttachment
      : value === "recalled"
        ? document.recalledAt !== null
        : false;
  }
  if (field === "is") {
    const value = parseIsValue(node.value);
    return value === "recalled"
      ? document.recalledAt !== null
      : value === "visible"
        ? document.visibleAt !== null
        : value === "hidden"
          ? document.visibleAt === null
          : false;
  }
  if (field === "before") {
    const timestamp = parseDateLike(node.value);
    return timestamp === undefined ? false : document.createdAt < timestamp;
  }
  if (field === "after" || field === "since") {
    const timestamp = parseDateLike(node.value);
    return timestamp === undefined ? false : document.createdAt >= timestamp;
  }
  return textContains(document.searchText, node.value, node.quoted);
};

const evaluateNode = (node: SearchSyntaxNode, document: MessageQueryDocument): boolean => {
  if (node.type === "text") {
    return evaluateText(node, document);
  }
  if (node.type === "comparison") {
    return evaluateComparison(node, document);
  }
  if (node.type === "not") {
    return !evaluateNode(node.child, document);
  }
  if (node.operator === "AND") {
    return node.children.every((child) => evaluateNode(child, document));
  }
  return node.children.some((child) => evaluateNode(child, document));
};

const buildFtsQuery = (node: SearchSyntaxNode): string | null => {
  const seeds = analyzeSeeds(node);
  if (seeds.length === 0) {
    return null;
  }
  const terms = seeds
    .map((seed) => buildFtsTerm(seed.value, seed.quoted))
    .filter((term): term is string => Boolean(term));
  return terms.length > 0 ? terms.join(" AND ") : null;
};

export const compileMessageQuery = (query: string): CompiledMessageQuery => {
  const ast = parseSearchSyntax(query);
  const candidateFilters = flattenTopLevelConjunction(ast)
    .map(extractCandidateFilter)
    .filter((filter): filter is MessageQueryCandidateFilter => filter !== null);
  return {
    ast,
    candidateFilters,
    ftsQuery: buildFtsQuery(ast),
    evaluate: (document) => evaluateNode(ast, document),
  };
};
