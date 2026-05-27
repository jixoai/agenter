import {
  ProductExtensionRuntimeClient,
  createProductExtensionRuntimeClient,
  type ProductExtensionRuntimeStore,
} from "@agenter/client-sdk";
import {
  createLocalFirstProductSourcePolicy,
  type ProductCommandDescriptor,
} from "@agenter/product-extension-runtime";

export const SHELL_NEXT_PRODUCT_ID = "shell-next" as const;
export const SHELL_NEXT_COMMAND = "shell2" as const;
export const SHELL_NEXT_DEFAULT_AVATAR = "shell-assistant" as const;
export const SHELL_NEXT_DEFAULT_SESSION = "1" as const;

export const shellNextProductDescriptor: ProductCommandDescriptor = {
  productId: SHELL_NEXT_PRODUCT_ID,
  command: SHELL_NEXT_COMMAND,
  packageName: "agenter-ext-shell-next",
  bin: {
    name: "agenter-shell-next",
    mainExport: "runShellNext",
  },
  sourcePolicy: createLocalFirstProductSourcePolicy(),
  capabilityHints: {
    interactive: true,
    foregroundProcess: true,
    requiresDaemon: true,
    runtimePlanes: ["launch", "resources", "assistant", "attention"],
  },
};

export const createShellNextProductRuntimeClient = (
  store: ProductExtensionRuntimeStore,
): ProductExtensionRuntimeClient => createProductExtensionRuntimeClient(store);
