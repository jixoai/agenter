import { z } from "zod";

export const appIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/u, "appId must be kebab-case");

export const appCommandSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/u, "app command must be kebab-case");

export const appPackageNameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u,
    "package name must be a valid lowercase npm package name",
  );

export const appSourceSchema = z.enum(["workspace", "installed", "remote"]);
export type AppSource = z.infer<typeof appSourceSchema>;

export const defaultAppSourceOrder = ["workspace", "installed", "remote"] as const satisfies readonly AppSource[];

export const appLaunchPlaneSchema = z.enum(["launch", "resources", "assistant", "attention"]);
export type AppLaunchPlane = z.infer<typeof appLaunchPlaneSchema>;

export const appBinDescriptorSchema = z.object({
  name: z.string().trim().min(1),
  path: z.string().trim().min(1).optional(),
  mainExport: z.string().trim().min(1).optional(),
});
export type AppBinDescriptor = z.infer<typeof appBinDescriptorSchema>;

export const appSourcePolicySchema = z.object({
  resolutionOrder: z.array(appSourceSchema).min(1),
  allowWorkspace: z.boolean().default(true),
  allowInstalled: z.boolean().default(true),
  allowRemote: z.boolean().default(true),
});
export type AppSourcePolicy = z.infer<typeof appSourcePolicySchema>;

export const appCapabilityHintsSchema = z.object({
  interactive: z.boolean().default(true),
  foregroundProcess: z.boolean().default(true),
  requiresDaemon: z.boolean().default(true),
  runtimePlanes: z.array(appLaunchPlaneSchema).default([]),
});
export type AppCapabilityHints = z.infer<typeof appCapabilityHintsSchema>;

export const appCommandDescriptorSchema = z.object({
  appId: appIdSchema,
  command: appCommandSchema,
  description: z.string().trim().min(1).optional(),
  packageName: appPackageNameSchema,
  bin: appBinDescriptorSchema,
  sourcePolicy: appSourcePolicySchema,
  capabilityHints: appCapabilityHintsSchema,
});
export type AppCommandDescriptor = z.infer<typeof appCommandDescriptorSchema>;

export const createLocalFirstAppSourcePolicy = (
  patch: Partial<Omit<AppSourcePolicy, "resolutionOrder">> = {},
): AppSourcePolicy => ({
  resolutionOrder: [...defaultAppSourceOrder],
  allowWorkspace: patch.allowWorkspace ?? true,
  allowInstalled: patch.allowInstalled ?? true,
  allowRemote: patch.allowRemote ?? true,
});
