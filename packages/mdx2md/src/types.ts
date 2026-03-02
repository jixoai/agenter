export type TagPolicyMode = "remove" | "text" | "allow";
export type ExpressionPolicyMode = "remove" | "text";

export interface SecurityOptions {
  allowFileDirs?: string[];
  allowNetHosts?: string[];
  allowNetProtocols?: Array<"http" | "https">;
}

export interface RuntimeIO {
  readFileText?: (absolutePath: string) => Promise<string>;
  fetchText?: (url: string) => Promise<string>;
}

export interface ResolvedSecurityOptions {
  allowFileDirs: string[];
  allowNetHosts: string[];
  allowNetProtocols: Array<"http" | "https">;
}

export interface MdxAttributeMap {
  [key: string]: string | boolean | null;
}

export interface ConvertWarning {
  code:
    | "TAG_REMOVED"
    | "TAG_TO_TEXT"
    | "TAG_UNWRAP"
    | "EXPRESSION_REMOVED"
    | "EXPRESSION_TO_TEXT"
    | "UNSUPPORTED_NODE";
  message: string;
  tagName?: string;
}

export interface TagTransformContext {
  tagName: string;
  attributes: MdxAttributeMap;
  childrenText: string;
  childrenMarkdown: string;
  kind: "flow" | "text";
  resources: import("./security").ResourceAccess;
}

export type TagTransformResult = string | null | undefined | { markdown: string };

export interface MdxToMdOptions {
  cwd?: string;
  defaultTagPolicy?: TagPolicyMode;
  expressionPolicy?: ExpressionPolicyMode;
  tagPolicies?: Record<string, TagPolicyMode>;
  tagTransforms?: Record<string, (context: TagTransformContext) => Promise<TagTransformResult> | TagTransformResult>;
  security?: SecurityOptions;
  runtimeIO?: RuntimeIO;
}

export interface MdxToMdResult {
  markdown: string;
  warnings: ConvertWarning[];
}
