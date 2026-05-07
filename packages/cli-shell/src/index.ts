import {
  ProductExtensionRuntimeClient,
  createProductExtensionRuntimeClient,
  type ProductExtensionRuntimeStore,
} from "@agenter/client-sdk";
import {
  createLocalFirstProductSourcePolicy,
  type ProductCommandDescriptor,
} from "@agenter/product-extension-runtime";

export const CLI_SHELL_PRODUCT_ID = "cli-shell" as const;
export const CLI_SHELL_COMMAND = "shell" as const;

export const cliShellProductDescriptor: ProductCommandDescriptor = {
  productId: CLI_SHELL_PRODUCT_ID,
  command: CLI_SHELL_COMMAND,
  packageName: "@agenter/cli-shell",
  bin: {
    name: "agenter-cli-shell",
  },
  sourcePolicy: createLocalFirstProductSourcePolicy(),
  capabilityHints: {
    interactive: true,
    foregroundProcess: true,
    requiresDaemon: true,
    runtimePlanes: ["launch", "resources", "assistant", "attention", "delegation"],
  },
};

export const createCliShellProductRuntimeClient = (
  store: ProductExtensionRuntimeStore,
): ProductExtensionRuntimeClient => createProductExtensionRuntimeClient(store);
