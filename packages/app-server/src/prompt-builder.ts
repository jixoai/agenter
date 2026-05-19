import { mdxToMd, type TagTransformContext, type TagTransformResult } from "@agenter/mdx2md";

import type { PromptDocument, PromptDocumentSource } from "./prompt-docs";

type PromptTagTransform = (context: TagTransformContext) => Promise<TagTransformResult> | TagTransformResult;

export interface PromptBuildContext {
  slots?: Record<string, string>;
  source?: PromptDocumentSource;
  readSlot?: (input: { src: string; document: PromptDocument; source?: PromptDocumentSource }) => Promise<string>;
  transforms?: Record<string, PromptTagTransform>;
}
const createBuiltinTransforms = (
  document: PromptDocument,
  context: PromptBuildContext,
): Record<string, PromptTagTransform> => ({
  Slot: async ({ attributes }) => {
    const src = typeof attributes.src === "string" ? attributes.src.trim() : "";
    if (src.length > 0) {
      return (await context.readSlot?.({ src, document, source: context.source ?? document.source })) ?? "";
    }
    const name = typeof attributes.name === "string" ? attributes.name.trim() : "";
    return context.slots?.[name] ?? "";
  },
});

export class PromptBuilder {
  async buildMd(document: PromptDocument, context: PromptBuildContext = {}): Promise<string> {
    const source = document.content;
    if (document.syntax === "md") {
      return source;
    }
    const transforms = {
      ...createBuiltinTransforms(document, {
        ...context,
        source: context.source ?? document.source,
      }),
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
