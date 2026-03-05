import type { Content, Root, Text } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { ResourceAccess } from "./security";
import type {
  ConvertWarning,
  ExpressionPolicyMode,
  MdxAttributeMap,
  MdxToMdOptions,
  MdxToMdResult,
  TagPolicyMode,
  TagTransformResult,
} from "./types";

interface MdNode {
  type: string;
  children?: MdNode[];
  value?: string;
  name?: string | null;
  attributes?: MdxAttributeLike[];
}

interface MdxJsxAttributeNode {
  type: "mdxJsxAttribute";
  name: string;
  value?: string | null | { type: "mdxJsxAttributeValueExpression"; value: string };
}

interface MdxJsxExpressionAttributeNode {
  type: "mdxJsxExpressionAttribute";
  value: string;
}

type MdxAttributeLike = MdxJsxAttributeNode | MdxJsxExpressionAttributeNode;

interface TransformContext {
  cwd: string;
  warnings: ConvertWarning[];
  resources: ResourceAccess;
  tagPolicies: Record<string, TagPolicyMode>;
  tagTransforms: MdxToMdOptions["tagTransforms"];
  defaultTagPolicy: TagPolicyMode;
  expressionPolicy: ExpressionPolicyMode;
}

const parseProcessor = unified().use(remarkParse).use(remarkMdx);
const stringifyProcessor = unified().use(remarkStringify);
const markdownBlockParser = unified().use(remarkParse);

const isNode = (input: unknown): input is MdNode => typeof input === "object" && input !== null && "type" in input;
const isParentNode = (input: MdNode): input is MdNode & { children: MdNode[] } => Array.isArray(input.children);

const getTagPolicy = (tagName: string | null | undefined, context: TransformContext): TagPolicyMode => {
  if (!tagName || tagName.trim().length === 0) {
    return context.defaultTagPolicy;
  }
  const exact = context.tagPolicies[tagName];
  if (exact) {
    return exact;
  }
  const lowered = context.tagPolicies[tagName.toLowerCase()];
  return lowered ?? context.defaultTagPolicy;
};

const attrsToMap = (attributes: MdxAttributeLike[] | undefined): MdxAttributeMap => {
  const result: MdxAttributeMap = {};
  if (!attributes) {
    return result;
  }
  for (const attribute of attributes) {
    if (attribute.type !== "mdxJsxAttribute") {
      continue;
    }
    const value = attribute.value;
    if (value === undefined || value === null) {
      result[attribute.name] = true;
      continue;
    }
    if (typeof value === "string") {
      result[attribute.name] = value;
      continue;
    }
    result[attribute.name] = `{${value.value}}`;
  }
  return result;
};

const attrsToText = (attributes: MdxAttributeLike[] | undefined): string => {
  if (!attributes || attributes.length === 0) {
    return "";
  }
  const parts: string[] = [];
  for (const attribute of attributes) {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      parts.push(`{${attribute.value}}`);
      continue;
    }
    if (attribute.value === undefined || attribute.value === null) {
      parts.push(attribute.name);
      continue;
    }
    if (typeof attribute.value === "string") {
      parts.push(`${attribute.name}="${attribute.value}"`);
      continue;
    }
    parts.push(`${attribute.name}={${attribute.value.value}}`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
};

const toMarkdown = (children: MdNode[]): string => {
  const root: Root = { type: "root", children: children as Content[] };
  return String(stringifyProcessor.stringify(root)).trim();
};

const toText = (node: MdNode): string => {
  if (typeof node.value === "string") {
    return node.value;
  }
  if (!node.children || node.children.length === 0) {
    return "";
  }
  return node.children.map(toText).join("");
};

const parseMarkdownNodes = (markdown: string): MdNode[] => {
  if (markdown.trim().length === 0) {
    return [];
  }
  const parsed = markdownBlockParser.parse(markdown) as Root;
  return (parsed.children as unknown[]).filter(isNode);
};

const textNode = (value: string): Text => ({ type: "text", value });

const warning = (context: TransformContext, input: ConvertWarning): void => {
  context.warnings.push(input);
};

const resolveTransformResult = (result: TagTransformResult): string | null => {
  if (result === null || result === undefined) {
    return null;
  }
  if (typeof result === "string") {
    return result;
  }
  return result.markdown;
};

const transformNode = async (
  node: MdNode,
  context: TransformContext,
  parentKind: "flow" | "text",
): Promise<MdNode[]> => {
  if (node.type === "mdxjsEsm") {
    warning(context, { code: "TAG_REMOVED", message: "Removed mdxjsEsm node", tagName: "mdxjsEsm" });
    return [];
  }
  if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
    if (context.expressionPolicy === "remove") {
      warning(context, { code: "EXPRESSION_REMOVED", message: "Removed MDX expression node" });
      return [];
    }
    warning(context, { code: "EXPRESSION_TO_TEXT", message: "Converted MDX expression to text" });
    return [textNode(`{${node.value ?? ""}}`)];
  }

  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    const kind: "flow" | "text" = node.type === "mdxJsxFlowElement" ? "flow" : "text";
    const transformedChildren = await transformChildren(node.children ?? [], context, kind);
    const tagName = node.name ?? "AnonymousComponent";
    const attrs = node.attributes ?? [];
    const transform = context.tagTransforms?.[tagName] ?? context.tagTransforms?.[tagName.toLowerCase()];
    if (transform) {
      const transformed = await transform({
        tagName,
        attributes: attrsToMap(attrs),
        childrenText: transformedChildren.map(toText).join(""),
        childrenMarkdown: toMarkdown(transformedChildren),
        kind,
        resources: context.resources,
      });
      const markdown = resolveTransformResult(transformed);
      if (markdown === null) {
        return [];
      }
      if (kind === "text" || parentKind === "text") {
        return [textNode(markdown)];
      }
      return parseMarkdownNodes(markdown);
    }

    const policy = getTagPolicy(tagName, context);
    if (policy === "remove") {
      warning(context, { code: "TAG_REMOVED", message: `Removed tag <${tagName}>`, tagName });
      return [];
    }
    if (policy === "allow") {
      warning(context, { code: "TAG_UNWRAP", message: `Unwrapped tag <${tagName}>`, tagName });
      return transformedChildren;
    }

    warning(context, { code: "TAG_TO_TEXT", message: `Converted tag <${tagName}> to text`, tagName });
    const attrsText = attrsToText(attrs);
    const inner = transformedChildren.length > 0 ? transformedChildren.map(toText).join("") : "";
    if (inner.length === 0) {
      return [textNode(`<${tagName}${attrsText} />`)];
    }
    return [textNode(`<${tagName}${attrsText}>${inner}</${tagName}>`)];
  }

  if (isParentNode(node)) {
    const nextChildren = await transformChildren(node.children, context, parentKind);
    return [{ ...node, children: nextChildren }];
  }
  return [node];
};

const transformChildren = async (
  children: MdNode[] | undefined,
  context: TransformContext,
  parentKind: "flow" | "text",
): Promise<MdNode[]> => {
  if (!children || children.length === 0) {
    return [];
  }
  const output: MdNode[] = [];
  for (const child of children) {
    const transformed = await transformNode(child, context, parentKind);
    output.push(...transformed);
  }
  return output;
};

export const mdxToMd = async (input: string, options: MdxToMdOptions = {}): Promise<MdxToMdResult> => {
  const root = parseProcessor.parse(input) as Root;
  const context: TransformContext = {
    cwd: options.cwd ?? process.cwd(),
    warnings: [],
    resources: new ResourceAccess(options.cwd ?? process.cwd(), options.security, options.runtimeIO),
    tagPolicies: options.tagPolicies ?? {},
    tagTransforms: options.tagTransforms,
    defaultTagPolicy: options.defaultTagPolicy ?? "text",
    expressionPolicy: options.expressionPolicy ?? "remove",
  };

  const transformedChildren = await transformChildren((root.children as unknown[]).filter(isNode), context, "flow");
  const nextRoot: Root = {
    type: "root",
    children: transformedChildren as Content[],
  };
  const markdown = String(stringifyProcessor.stringify(nextRoot)).trim();
  return {
    markdown,
    warnings: context.warnings,
  };
};
