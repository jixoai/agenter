import { z } from "zod";

export const productIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/u, "productId must be kebab-case");

export const productCommandSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/u, "product command must be kebab-case");

export const productPackageNameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u,
    "package name must be a valid lowercase npm package name",
  );

export const productSourceSchema = z.enum(["workspace", "installed", "remote"]);
export type ProductSource = z.infer<typeof productSourceSchema>;

export const defaultProductSourceOrder = ["workspace", "installed", "remote"] as const satisfies readonly ProductSource[];

export const productLaunchPlaneSchema = z.enum(["launch", "resources", "assistant", "attention"]);
export type ProductLaunchPlane = z.infer<typeof productLaunchPlaneSchema>;

export const productBinDescriptorSchema = z.object({
  name: z.string().trim().min(1),
  path: z.string().trim().min(1).optional(),
  mainExport: z.string().trim().min(1).optional(),
});
export type ProductBinDescriptor = z.infer<typeof productBinDescriptorSchema>;

export const productSourcePolicySchema = z.object({
  resolutionOrder: z.array(productSourceSchema).min(1),
  allowWorkspace: z.boolean().default(true),
  allowInstalled: z.boolean().default(true),
  allowRemote: z.boolean().default(true),
});
export type ProductSourcePolicy = z.infer<typeof productSourcePolicySchema>;

export const productCapabilityHintsSchema = z.object({
  interactive: z.boolean().default(true),
  foregroundProcess: z.boolean().default(true),
  requiresDaemon: z.boolean().default(true),
  runtimePlanes: z.array(productLaunchPlaneSchema).default([]),
});
export type ProductCapabilityHints = z.infer<typeof productCapabilityHintsSchema>;

export const productCommandDescriptorSchema = z.object({
  productId: productIdSchema,
  command: productCommandSchema,
  packageName: productPackageNameSchema,
  bin: productBinDescriptorSchema,
  sourcePolicy: productSourcePolicySchema,
  capabilityHints: productCapabilityHintsSchema,
});
export type ProductCommandDescriptor = z.infer<typeof productCommandDescriptorSchema>;

export const createLocalFirstProductSourcePolicy = (
  patch: Partial<Omit<ProductSourcePolicy, "resolutionOrder">> = {},
): ProductSourcePolicy => ({
  resolutionOrder: [...defaultProductSourceOrder],
  allowWorkspace: patch.allowWorkspace ?? true,
  allowInstalled: patch.allowInstalled ?? true,
  allowRemote: patch.allowRemote ?? true,
});
