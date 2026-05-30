import {
  createLocalFirstAppSourcePolicy,
  appCommandDescriptorSchema,
  type AppCommandDescriptor,
} from "@agenter/app-runtime";

const appCommandDescriptors = [
  appCommandDescriptorSchema.parse({
    appId: "shell",
    command: "shell",
    description: "run Shell terminal workspace",
    packageName: "agenter-app-shell",
    bin: {
      name: "agenter-shell",
      mainExport: "runShell",
    },
    sourcePolicy: createLocalFirstAppSourcePolicy(),
    capabilityHints: {
      interactive: true,
      foregroundProcess: true,
      requiresDaemon: true,
      runtimePlanes: ["launch", "resources", "assistant", "attention"],
    },
  }),
  appCommandDescriptorSchema.parse({
    appId: "studio",
    command: "studio",
    description: "run Studio web UI",
    packageName: "agenter-app-studio",
    bin: {
      name: "agenter-studio",
      mainExport: "runStudio",
    },
    sourcePolicy: createLocalFirstAppSourcePolicy(),
    capabilityHints: {
      interactive: true,
      foregroundProcess: true,
      requiresDaemon: true,
      runtimePlanes: ["launch", "resources", "assistant", "attention"],
    },
  }),
] as const satisfies readonly AppCommandDescriptor[];

const descriptorByCommand = new Map(appCommandDescriptors.map((descriptor) => [descriptor.command, descriptor] as const));

export const listAppCommandDescriptors = (): readonly AppCommandDescriptor[] => appCommandDescriptors;

export const resolveAppCommandDescriptor = (command: string): AppCommandDescriptor | null =>
  descriptorByCommand.get(command) ?? null;
