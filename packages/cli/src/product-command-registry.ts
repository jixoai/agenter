import {
  createLocalFirstProductSourcePolicy,
  productCommandDescriptorSchema,
  type ProductCommandDescriptor,
} from "@agenter/product-extension-runtime";

const productCommandDescriptors = [
  productCommandDescriptorSchema.parse({
    productId: "cli-shell",
    command: "shell",
    packageName: "@agenter/cli-shell",
    bin: {
      name: "agenter-cli-shell",
      mainExport: "runCliShell",
    },
    sourcePolicy: createLocalFirstProductSourcePolicy(),
    capabilityHints: {
      interactive: true,
      foregroundProcess: true,
      requiresDaemon: true,
      runtimePlanes: ["launch", "resources", "assistant", "attention", "delegation"],
    },
  }),
] as const satisfies readonly ProductCommandDescriptor[];

const descriptorByCommand = new Map(productCommandDescriptors.map((descriptor) => [descriptor.command, descriptor] as const));

export const listProductCommandDescriptors = (): readonly ProductCommandDescriptor[] => productCommandDescriptors;

export const resolveProductCommandDescriptor = (command: string): ProductCommandDescriptor | null =>
  descriptorByCommand.get(command) ?? null;
