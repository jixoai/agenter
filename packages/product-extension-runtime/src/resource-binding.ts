import { z } from "zod";

import { productIdSchema } from "./descriptor";

export const productResourceKeySchema = z.string().trim().min(1);
export const productResourceKindSchema = z.enum(["terminal", "room"]);
export const productResourceOwnerSystemSchema = z.enum(["terminal-system", "message-system"]);

export type ProductResourceKind = z.infer<typeof productResourceKindSchema>;
export type ProductResourceOwnerSystem = z.infer<typeof productResourceOwnerSystemSchema>;

export const productBindingMetadataSchema = z.object({
  productId: productIdSchema,
  resourceKey: productResourceKeySchema,
  ownerSystem: productResourceOwnerSystemSchema,
});
export type ProductBindingMetadata = z.infer<typeof productBindingMetadataSchema>;

export const productResourceBindingInputSchema = z.object({
  productId: productIdSchema,
  resourceKey: productResourceKeySchema,
  resourceKind: productResourceKindSchema,
  ownerSystem: productResourceOwnerSystemSchema,
  title: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ProductResourceBindingInput = z.infer<typeof productResourceBindingInputSchema>;

export const buildProductBindingMetadata = (input: ProductResourceBindingInput): ProductBindingMetadata => ({
  productId: input.productId,
  resourceKey: input.resourceKey,
  ownerSystem: input.ownerSystem,
});

export const matchesProductBindingMetadata = (
  value: unknown,
  expected: Pick<ProductBindingMetadata, "productId" | "resourceKey">,
): boolean => {
  const parsed = productBindingMetadataSchema.safeParse(value);
  if (!parsed.success) {
    return false;
  }
  return parsed.data.productId === expected.productId && parsed.data.resourceKey === expected.resourceKey;
};
