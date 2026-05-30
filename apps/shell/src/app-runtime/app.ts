import {
  AppRuntimeClient,
  createAppRuntimeClient,
  type AppRuntimeStore,
} from "@agenter/client-sdk";
import {
  createLocalFirstAppSourcePolicy,
  type AppCommandDescriptor,
} from "@agenter/app-runtime";

export const SHELL_APP_ID = "shell" as const;
export const SHELL_COMMAND = "shell" as const;
export const SHELL_DEFAULT_AVATAR = "shell-assistant" as const;
export const SHELL_DEFAULT_SESSION = "1" as const;

export const shellAppDescriptor: AppCommandDescriptor = {
  appId: SHELL_APP_ID,
  command: SHELL_COMMAND,
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
};

export const createShellAppRuntimeClient = (
  store: AppRuntimeStore,
): AppRuntimeClient => createAppRuntimeClient(store);
