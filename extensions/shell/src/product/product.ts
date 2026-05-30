import {
  ProductExtensionRuntimeClient,
  createProductExtensionRuntimeClient,
  type ProductExtensionRuntimeStore,
} from "@agenter/client-sdk";
import {
  createLocalFirstProductSourcePolicy,
  type ProductCommandDescriptor,
} from "@agenter/product-extension-runtime";

export const SHELL_PRODUCT_ID = "shell" as const;
export const SHELL_COMMAND = "shell" as const;
export const SHELL_DEFAULT_AVATAR = "shell-assistant" as const;
export const SHELL_DEFAULT_SESSION = "1" as const;

export const shellProductDescriptor: ProductCommandDescriptor = {
  productId: SHELL_PRODUCT_ID,
  command: SHELL_COMMAND,
  packageName: "agenter-ext-shell",
  bin: {
    name: "agenter-shell",
    mainExport: "runShell",
  },
  sourcePolicy: createLocalFirstProductSourcePolicy(),
  capabilityHints: {
    interactive: true,
    foregroundProcess: true,
    requiresDaemon: true,
    runtimePlanes: ["launch", "resources", "assistant", "attention"],
  },
};

export const createShellProductRuntimeClient = (
  store: ProductExtensionRuntimeStore,
): ProductExtensionRuntimeClient => createProductExtensionRuntimeClient(store);
