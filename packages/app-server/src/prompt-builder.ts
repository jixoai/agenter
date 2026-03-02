import { mdxToMd, type TagTransformContext, type TagTransformResult } from "@agenter/mdx2md";

import type { PromptDocument } from "./prompt-docs";

type PromptTagTransform = (context: TagTransformContext) => Promise<TagTransformResult> | TagTransformResult;

export interface PromptBuildContext {
  slots?: Record<string, string>;
  transforms?: Record<string, PromptTagTransform>;
}
const createBuiltinTransforms = (context: PromptBuildContext): Record<string, PromptTagTransform> => ({
  Slot: ({ attributes }) => {
    const name = typeof attributes.name === "string" ? attributes.name.trim() : "";
    return context.slots?.[name] ?? "";
  },
});

export class PromptBuilder {
  async buildMd(document: PromptDocument, context: PromptBuildContext = {}): Promise<string> {
    const source = document.content.trim();
    if (document.syntax === "md") {
      return source;
    }
    const transforms = {
      ...createBuiltinTransforms(context),
      ...(context.transforms ?? {}),
    };
    const rendered = await mdxToMd(source, {
      defaultTagPolicy: "remove",
      expressionPolicy: "remove",
      tagTransforms: transforms,
    });
    return rendered.markdown.trim();
  }
}
