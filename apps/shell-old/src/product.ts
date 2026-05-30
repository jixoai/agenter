import {
  AppRuntimeClient,
  createAppRuntimeClient,
  type AppRuntimeStore,
} from "@agenter/client-sdk";
import {
  createLocalFirstAppSourcePolicy,
  type AppCommandDescriptor,
} from "@agenter/app-runtime";

export const CLI_SHELL_APP_ID = "cli-shell" as const;
export const CLI_SHELL_COMMAND = "shell" as const;
export const CLI_SHELL_DEFAULT_AVATAR = "shell-assistant" as const;
export const CLI_SHELL_DEFAULT_SESSION = "1" as const;

export const cliShellProductDescriptor: AppCommandDescriptor = {
  appId: CLI_SHELL_APP_ID,
  command: CLI_SHELL_COMMAND,
  packageName: "agenter-app-shell",
  bin: {
    name: "agenter-cli-shell",
    mainExport: "runCliShell",
  },
  sourcePolicy: createLocalFirstAppSourcePolicy(),
  capabilityHints: {
    interactive: true,
    foregroundProcess: true,
    requiresDaemon: true,
    runtimePlanes: ["launch", "resources", "assistant", "attention"],
  },
};

export const createCliShellAppRuntimeClient = (
  store: AppRuntimeStore,
): AppRuntimeClient => createAppRuntimeClient(store);
