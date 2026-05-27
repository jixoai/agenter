import {
  createLocalFirstProductSourcePolicy,
  productCommandDescriptorSchema,
  type ProductCommandDescriptor,
} from "@agenter/product-extension-runtime";

const productCommandDescriptors = [
  productCommandDescriptorSchema.parse({
    productId: "cli-shell",
    command: "shell",
    description: "run cli-shell terminal workspace",
    packageName: "agenter-ext-shell",
    bin: {
      name: "agenter-cli-shell",
      mainExport: "runCliShell",
    },
    sourcePolicy: createLocalFirstProductSourcePolicy(),
    capabilityHints: {
      interactive: true,
      foregroundProcess: true,
      requiresDaemon: true,
      runtimePlanes: ["launch", "resources", "assistant", "attention"],
    },
  }),
  productCommandDescriptorSchema.parse({
    productId: "shell-next",
    command: "shell2",
    description: "run shell-next renderable mux incubation",
    packageName: "agenter-ext-shell-next",
    bin: {
      name: "agenter-shell-next",
      mainExport: "runShellNext",
    },
    sourcePolicy: createLocalFirstProductSourcePolicy({
      allowInstalled: false,
      allowRemote: false,
    }),
    capabilityHints: {
      interactive: true,
      foregroundProcess: true,
      requiresDaemon: true,
      runtimePlanes: ["launch", "resources", "assistant", "attention"],
    },
  }),
  productCommandDescriptorSchema.parse({
    productId: "studio",
    command: "studio",
    description: "run Studio web UI",
    packageName: "agenter-ext-studio",
    bin: {
      name: "agenter-studio",
      mainExport: "runStudio",
    },
    sourcePolicy: createLocalFirstProductSourcePolicy(),
    capabilityHints: {
      interactive: true,
      foregroundProcess: true,
      requiresDaemon: true,
      runtimePlanes: ["launch", "resources", "assistant", "attention"],
    },
  }),
] as const satisfies readonly ProductCommandDescriptor[];

const descriptorByCommand = new Map(productCommandDescriptors.map((descriptor) => [descriptor.command, descriptor] as const));

export const listProductCommandDescriptors = (): readonly ProductCommandDescriptor[] => productCommandDescriptors;

export const resolveProductCommandDescriptor = (command: string): ProductCommandDescriptor | null =>
  descriptorByCommand.get(command) ?? null;
